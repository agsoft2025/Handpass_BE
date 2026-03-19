const { pool } = require("../config/database");

exports.createDeviceGroupAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { sn, remote_group_id, time_group_id, del_flag = 0 } = req.body;
    const timestamp = Date.now();

    if (!sn || !remote_group_id || !time_group_id) {
      return res.status(400).json({
        code: 400,
        msg: "sn, remote_group_id, time_group_id are required",
        data: null,
      });
    }

    await client.query("BEGIN");

    const tgRes = await client.query(
      `SELECT id, time_group_id FROM time_groups WHERE time_group_id = $1 AND del_flag = false`,
      [time_group_id]
    );

    if (tgRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        code: 400,
        msg: "Time group not found",
        data: null,
      });
    }

    const timeGroupUuid = tgRes.rows[0].id;

    const query = `
      INSERT INTO device_group_assignments
        (sn, remote_group_id, time_group_id, time_group_uuid, timestamp, del_flag)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      sn,
      remote_group_id,
      time_group_id,
      timeGroupUuid,
      Number(timestamp),
      Boolean(del_flag),
    ];

    const result = await client.query(query, values);
    await client.query("COMMIT");

    return res.status(201).json({
      code: 200,
      msg: "success",
      data: result.rows[0],
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

exports.getDeviceGroupAssignments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sort_by = "dga.remote_group_id",
      sort_order = "ASC",
      del_flag = 0,
      sn,
    } = req.query;

    const parsedDelFlag = Number(del_flag);
    if (![0, 1].includes(parsedDelFlag)) {
      return res.status(400).json({ code: 400, msg: "del_flag", data: null });
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const validSortFields = [
      "dga.remote_group_id",
      "dga.time_group_id",
      "dga.timestamp",
      "dga.created_at",
      "dga.updated_at",
      "dga.sn",
    ];

    const sortField = validSortFields.includes(sort_by) ? sort_by : "dga.remote_group_id";
    const sortDirection = String(sort_order).toUpperCase() === "DESC" ? "DESC" : "ASC";

    const whereConditions = ["dga.del_flag = $1"];
    const values = [parsedDelFlag === 1];
    let paramIndex = 2;

    if (sn) {
      whereConditions.push(`dga.sn = $${paramIndex++}`);
      values.push(sn);
    }

    if (search) {
      whereConditions.push(
        `(
          dga.remote_group_id ILIKE $${paramIndex}
          OR dga.time_group_id ILIKE $${paramIndex}
          OR dga.sn ILIKE $${paramIndex}
        )`
      );
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const query = `
      SELECT
        dga.id,
        dga.sn,
        dga.remote_group_id,
        dga.time_group_id,
        dga.time_group_uuid,
        dga.timestamp,
        dga.del_flag,
        d.device_name,
        tg.time_configs
      FROM device_group_assignments dga
      LEFT JOIN devices d ON dga.sn = d.sn
      LEFT JOIN time_groups tg ON dga.time_group_uuid = tg.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limitNum, offset);

    const result = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) FROM device_group_assignments dga ${whereClause}`;
    const countResult = await pool.query(countQuery, values.slice(0, values.length - 2));

    const total = Number(countResult.rows[0].count);

    return res.status(200).json({
      code: 200,
      msg: "operation successful",
      data: result.rows.map((row) => ({
        id: row.id,
        sn: row.sn,
        remote_group_id: row.remote_group_id,
        time_group_id: row.time_group_id,
        timestamp: String(row.timestamp),
        del_flag: row.del_flag,
        device: {
          name: row.device_name,
        },
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
    return res.status(500).json({ code: 500, msg: "internal server down", data: null });
  }
};

exports.updateDeviceGroupAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { sn, remote_group_id, time_group_id, del_flag } = req.body;

    if (!id) {
      return res.status(400).json({ code: 400, msg: "ID is required", data: null });
    }

    await client.query("BEGIN");

    const existingRes = await client.query(`SELECT * FROM device_group_assignments WHERE id = $1`, [id]);

    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ code: 404, msg: "Assignment not found", data: null });
    }

    const current = existingRes.rows[0];

    const newSn = typeof sn !== "undefined" ? sn : current.sn;
    const newRemoteGroupId = typeof remote_group_id !== "undefined" ? remote_group_id : current.remote_group_id;
    const newTimeGroupId = typeof time_group_id !== "undefined" ? time_group_id : current.time_group_id;

    const tgRes = await client.query(
      `SELECT id FROM time_groups WHERE time_group_id = $1 AND del_flag = false`,
      [newTimeGroupId]
    );

    if (tgRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ code: 400, msg: "Time group not found", data: null });
    }

    const timeGroupUuid = tgRes.rows[0].id;

    const fields = [];
    const values = [];
    let index = 1;

    fields.push(`sn = $${index++}`);
    values.push(newSn);

    fields.push(`remote_group_id = $${index++}`);
    values.push(newRemoteGroupId);

    fields.push(`time_group_id = $${index++}`);
    values.push(newTimeGroupId);

    fields.push(`time_group_uuid = $${index++}`);
    values.push(timeGroupUuid);

    if (typeof del_flag !== "undefined") {
      fields.push(`del_flag = $${index++}`);
      values.push(Boolean(del_flag));
    }

    fields.push(`timestamp = $${index++}`);
    values.push(Date.now());

    fields.push(`updated_at = now()`);

    values.push(id);

    const updateQuery = `
      UPDATE device_group_assignments
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return res.status(200).json({ code: 0, msg: "Success", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ code: 409, msg: error.message, data: null });
    }
    return res.status(500).json({ code: 500, msg: "Failed to update assignment", data: null });
  } finally {
    client.release();
  }
};

exports.softDeleteDeviceGroupAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { sn, remote_group_id } = req.body;

    if (!sn || !remote_group_id) {
      return res.status(400).json({ code: 400, msg: "sn and remote_group_id required", data: null });
    }

    await client.query("BEGIN");

    const check = await client.query(
      `SELECT id FROM device_group_assignments WHERE sn = $1 AND remote_group_id = $2`,
      [sn, remote_group_id]
    );

    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ code: 404, msg: "not deleted", data: null });
    }

    await client.query(
      `
      UPDATE device_group_assignments
      SET del_flag = true,
          timestamp = $1,
          updated_at = now()
      WHERE sn = $2 AND remote_group_id = $3
      `,
      [Date.now(), sn, remote_group_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({ code: 0, msg: "Assignment soft delete successful", data: null });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ code: 500, msg: "internal server down", data: null });
  } finally {
    client.release();
  }
};
