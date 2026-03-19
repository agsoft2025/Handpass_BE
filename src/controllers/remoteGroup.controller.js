const { pool } = require("../config/database");

exports.createRemoteGroup = async (req, res) => {
  const client = await pool.connect();

  try {
    const { group_id, sn, del_flag = 0 } = req.body;
    const timestamp = Date.now();

    if (!group_id || !sn) {
      return res.status(400).json({
        code: 400,
        msg: "group_id and sn are required",
        data: null,
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO wiegand_groups
        (group_id, sn, timestamp, del_flag, time_configs)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING id, group_id, sn, timestamp, del_flag;
      `,
      [group_id, sn, timestamp, Boolean(del_flag), JSON.stringify([])]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      code: 200,
      msg: "success",
      data: {
        ...result.rows[0],
        timestamp: String(result.rows[0].timestamp),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        code: 409,
        msg: "A remote group with this group_id already exists for this serial number",
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

exports.getRemoteGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sort_by = "wg.group_id",
      sort_order = "ASC",
      del_flag = 0,
      sn,
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
      "wg.group_id",
      "wg.sn",
      "wg.timestamp",
      "wg.created_at",
      "wg.updated_at",
    ];

    const sortField = validSortFields.includes(sort_by) ? sort_by : "wg.group_id";
    const sortDirection = String(sort_order).toUpperCase() === "DESC" ? "DESC" : "ASC";

    const whereConditions = ["wg.del_flag = $1"];
    const values = [parsedDelFlag === 1];
    let paramIndex = 2;

    if (sn) {
      whereConditions.push(`wg.sn = $${paramIndex++}`);
      values.push(sn);
    }

    if (search) {
      whereConditions.push(`(wg.group_id ILIKE $${paramIndex} OR wg.sn ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const result = await pool.query(
      `
      SELECT
        wg.id,
        wg.group_id,
        wg.sn,
        wg.timestamp,
        wg.del_flag,
        d.device_name,
        d.device_ip,
        d.online_status
      FROM wiegand_groups wg
      LEFT JOIN devices d ON d.sn = wg.sn
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `,
      [...values, limitNum, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM wiegand_groups wg ${whereClause}`,
      values
    );

    const total = Number(countResult.rows[0].count);

    return res.status(200).json({
      code: 200,
      msg: "operation successful",
      data: result.rows.map((row) => ({
        id: row.id,
        group_id: row.group_id,
        sn: row.sn,
        timestamp: String(row.timestamp),
        del_flag: row.del_flag,
        device: {
          name: row.device_name,
          ip: row.device_ip,
          online_status: row.online_status,
        },
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

exports.updateRemoteGroup = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { sn, group_id, del_flag } = req.body;

    if (!id) {
      return res.status(400).json({
        code: 400,
        msg: "ID is required",
        data: null,
      });
    }

    await client.query("BEGIN");

    const existingRes = await client.query(`SELECT * FROM wiegand_groups WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: 404,
        msg: "Remote group not found",
        data: null,
      });
    }

    const current = existingRes.rows[0];
    const newSn = typeof sn !== "undefined" ? sn : current.sn;
    const newGroupId = typeof group_id !== "undefined" ? group_id : current.group_id;

    const conflict = await client.query(
      `
      SELECT id
      FROM wiegand_groups
      WHERE sn = $1 AND group_id = $2 AND id != $3
      `,
      [newSn, newGroupId, id]
    );

    if (conflict.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        code: 409,
        msg: "A remote group with this group_id already exists for this serial number",
        data: null,
      });
    }

    const fields = [];
    const values = [];
    let index = 1;

    fields.push(`sn = $${index++}`);
    values.push(newSn);

    fields.push(`group_id = $${index++}`);
    values.push(newGroupId);

    if (typeof del_flag !== "undefined") {
      fields.push(`del_flag = $${index++}`);
      values.push(Boolean(del_flag));
    }

    fields.push(`timestamp = $${index++}`);
    values.push(Date.now());

    fields.push(`updated_at = now()`);

    values.push(id);

    const result = await client.query(
      `
      UPDATE wiegand_groups
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING id, group_id, sn, timestamp, del_flag;
      `,
      values
    );

    await client.query("COMMIT");

    return res.status(200).json({
      code: 0,
      msg: "Success",
      data: {
        ...result.rows[0],
        timestamp: String(result.rows[0].timestamp),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        code: 409,
        msg: "A remote group with this group_id already exists for this serial number",
        data: null,
      });
    }

    return res.status(500).json({
      code: 500,
      msg: "Failed to update remote group",
      data: null,
    });
  } finally {
    client.release();
  }
};

exports.softDeleteRemoteGroup = async (req, res) => {
  const client = await pool.connect();

  try {
    const { group_id, sn } = req.body;

    if (!group_id || !sn) {
      return res.status(400).json({
        code: 400,
        msg: "group_id and sn are required",
        data: null,
      });
    }

    await client.query("BEGIN");

    const existingRes = await client.query(
      `SELECT id FROM wiegand_groups WHERE group_id = $1 AND sn = $2`,
      [group_id, sn]
    );

    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: 404,
        msg: "Remote group not found",
        data: null,
      });
    }

    await client.query(
      `
      UPDATE wiegand_groups
      SET del_flag = true,
          timestamp = $1,
          updated_at = now()
      WHERE group_id = $2 AND sn = $3
      `,
      [Date.now(), group_id, sn]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      code: 0,
      msg: "Remote group soft delete successful",
      data: null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      code: 500,
      msg: "internal server down",
      data: null,
    });
  } finally {
    client.release();
  }
};
