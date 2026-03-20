const { pool } = require("../config/database");

exports.createTimeGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    const { time_group_id, time_configs = [], del_flag = 0 } = req.body;
    const normalizedTimeGroupId = String(time_group_id || "").trim();
    const timestamp = Date.now();

    if (!normalizedTimeGroupId || !timestamp) {
      return res.status(400).json({
        code: 400,
        msg: "time_group_id, timestamp",
        data: null,
      });
    }

    if (!Array.isArray(time_configs)) {
      return res.status(400).json({
        code: 400,
        msg: "time_configs",
        data: null,
      });
    }

    await client.query("BEGIN");

    const existingTimeGroup = await client.query(
      `
      SELECT id, time_group_id
      FROM time_groups
      WHERE LOWER(TRIM(time_group_id)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [normalizedTimeGroupId]
    );

    if (existingTimeGroup.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: 409,
        msg: `time_group_id ${existingTimeGroup.rows[0].time_group_id} already exists`,
        data: null,
      });
    }

    const query = `
      INSERT INTO time_groups
        (time_group_id, timestamp, del_flag, time_configs)
      VALUES
        ($1, $2, $3, $4)
      RETURNING id, time_group_id, timestamp, del_flag, time_configs;
    `;

    const values = [
      normalizedTimeGroupId,
      Number(timestamp),
      Boolean(del_flag),
      JSON.stringify(time_configs),
    ];

    const result = await client.query(query, values);
    await client.query("COMMIT");

    const row = result.rows[0];
    return res.status(200).json({
      code: 200,
      msg: "success",
      data: {
        id: row.id,
        time_group_id: row.time_group_id,
        timestamp: String(row.timestamp),
        del_flag: row.del_flag,
        time_configs: row.time_configs,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({
        code: 409,
        msg: error.message,
        data: null,
      });
    }

    return res.status(500).json({
      code: 500,
      msg: error.message,
      data: null,
    });
  } finally {
    client.release();
  }
};

exports.getTimeGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sort_by = "tg.time_group_id",
      sort_order = "ASC",
      del_flag = 0,
    } = req.query;

    const parsedDelFlag = Number(del_flag);
    if (![0, 1].includes(parsedDelFlag)) {
      return res.status(400).json({
        code: 400,
        msg: "del_flag",
        data: null,
      });
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const validSortFields = [
      "tg.time_group_id",
      "tg.timestamp",
      "tg.created_at",
      "tg.updated_at",
    ];

    const sortField = validSortFields.includes(sort_by) ? sort_by : "tg.time_group_id";
    const sortDirection = String(sort_order).toUpperCase() === "DESC" ? "DESC" : "ASC";

    const whereConditions = ["tg.del_flag = $1"];
    const values = [parsedDelFlag === 1];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(tg.time_group_id ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const query = `
      SELECT
        tg.id,
        tg.time_group_id,
        tg.timestamp,
        tg.del_flag,
        tg.time_configs
      FROM time_groups tg
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limitNum, offset);

    const result = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) FROM time_groups tg ${whereClause}`;
    const countResult = await pool.query(countQuery, values.slice(0, values.length - 2));

    const total = Number(countResult.rows[0].count);

    return res.status(200).json({
      code: 200,
      msg: "operation successful",
      data: result.rows.map((row) => ({
        id: row.id,
        time_group_id: row.time_group_id,
        timestamp: String(row.timestamp),
        del_flag: row.del_flag,
        time_configs: row.time_configs,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      msg: "internal server down",
      data: null,
    });
  }
};

exports.updateTimeGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { time_group_id, time_configs, del_flag } = req.body;

    if (!id) {
      return res.status(400).json({
        code: 400,
        msg: "ID is required",
        data: null,
      });
    }

    await client.query("BEGIN");

    const existingRes = await client.query(`SELECT * FROM time_groups WHERE id = $1`, [id]);

    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: 404,
        msg: "Time group not found",
        data: null,
      });
    }

    const current = existingRes.rows[0];

    const fields = [];
    const values = [];
    let index = 1;

    if (typeof time_group_id !== "undefined") {
      const normalizedTimeGroupId = String(time_group_id || "").trim();

      if (!normalizedTimeGroupId) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          code: 400,
          msg: "time_group_id is required",
          data: null,
        });
      }

      const duplicateRes = await client.query(
        `
        SELECT id
        FROM time_groups
        WHERE LOWER(TRIM(time_group_id)) = LOWER(TRIM($1))
          AND id != $2
        LIMIT 1
        `,
        [normalizedTimeGroupId, id]
      );

      if (duplicateRes.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: 409,
          msg: `time_group_id ${normalizedTimeGroupId} already exists`,
          data: null,
        });
      }

      fields.push(`time_group_id = $${index++}`);
      values.push(normalizedTimeGroupId);
    }

    if (typeof time_configs !== "undefined") {
      let parsed;
      try {
        parsed = typeof time_configs === "string" ? JSON.parse(time_configs) : time_configs;
      } catch {
        await client.query("ROLLBACK");
        return res.status(400).json({ code: 400, msg: "Invalid JSON format for time_configs", data: null });
      }

      if (!Array.isArray(parsed)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ code: 400, msg: "time_configs must be an array", data: null });
      }

      fields.push(`time_configs = $${index++}`);
      values.push(JSON.stringify(parsed));
    }

    if (typeof del_flag !== "undefined") {
      fields.push(`del_flag = $${index++}`);
      values.push(Boolean(del_flag));
    }

    fields.push(`timestamp = $${index++}`);
    values.push(Date.now());

    fields.push(`updated_at = now()`);

    if (fields.length <= 2) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        code: 400,
        msg: "No valid fields provided for update",
        data: null,
      });
    }

    values.push(id);

    const updateQuery = `
      UPDATE time_groups
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    const row = result.rows[0] || current;
    return res.status(200).json({
      code: 0,
      msg: "Success",
      data: row,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      code: 500,
      msg: "Failed to update time group",
      data: null,
    });
  } finally {
    client.release();
  }
};

exports.softDeleteTimeGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    const { time_group_id } = req.body;

    if (!time_group_id) {
      return res.status(400).json({ code: 400, msg: "time_group_id required", data: null });
    }

    await client.query("BEGIN");

    const check = await client.query(
      `SELECT id FROM time_groups WHERE time_group_id = $1`,
      [time_group_id]
    );

    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ code: 404, msg: "not deleted", data: null });
    }

    await client.query(
      `
      UPDATE time_groups
      SET del_flag = true,
          timestamp = $1,
          updated_at = now()
      WHERE time_group_id = $2
      `,
      [Date.now(), time_group_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({ code: 0, msg: "Time group soft delete successful", data: null });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ code: 500, msg: "internal server down", data: null });
  } finally {
    client.release();
  }
};
