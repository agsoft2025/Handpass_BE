const { pool } = require("../config/database");

exports.addUserWiegand1 = async (req, res) => {
  try {
    const { sn, user_id, group_id = '', del_flag = false } = req.body;
    const timestamp = Math.floor(Date.now() / 1000)

    const istTime = new Date(timestamp * 1000).toLocaleString(
      "en-IN",
      { timeZone: "Asia/Kolkata" }
    )

    // Basic validation
    if (!sn || !user_id || !timestamp) {
      return res.status(400).json({
        success: false,
        message: "sn, user_id and timestamp are required"
      });
    }
    const userExisting = await pool.query(`SELECT * FROM user_wiegands WHERE user_id=$1 AND group_id =$2`, [user_id, group_id])
    if (userExisting.rows.length != 0) {
      return res.status(400).json({ success: false, message: "user with same group already existing" })
    }
    const existWiegandGrp = await pool.query(`SELECT group_id, id FROM wiegand_groups WHERE group_id = $1`, [group_id])
    if (existWiegandGrp.rows.length == 0) {
      return res.status(400).json({ success: false, message: "could not able to find group" })
    }

    const query = `
      INSERT INTO user_wiegands (sn, user_id, group_id,group_uuid, timestamp, del_flag)
      VALUES ($1, $2, $3, $4, $5,$6)
      RETURNING *;
    `;

    const values = [
      sn,
      user_id,
      group_id,
      existWiegandGrp.rows[0].id,
      timestamp,
      del_flag
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add UserWiegand Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.addUserWiegand = async (req, res) => {
  try {

    const { sn, user_id, group_id = '', del_flag = false } = req.body;

    if (!sn || !user_id || !group_id) {
      return res.status(400).json({
        success: false,
        message: "sn, user_id and group_id are required"
      });
    }

    // const timestamp = Math.floor(Date.now() / 1000);
    const timestamp = Date.now();

    // check group exists
    const existWiegandGrp = await pool.query(
      `SELECT group_id, id FROM wiegand_groups WHERE group_id = $1`,
      [group_id]
    );
    if (existWiegandGrp.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Group not found"
      });
    }

    // 🔹 check if already exists
    const existingUser = await pool.query(
      `SELECT id FROM user_wiegands WHERE user_id = $1 AND sn = $2`,
      [user_id, sn]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Group already existing for this user and device"
      });
    }

    const query1 = `
      INSERT INTO user_wiegands
      (sn, user_id, group_id, group_uuid, timestamp, del_flag)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id, sn)
      DO UPDATE SET
        group_id = EXCLUDED.group_id,
        group_uuid = EXCLUDED.group_uuid,
        timestamp = EXCLUDED.timestamp,
        del_flag = EXCLUDED.del_flag
      RETURNING *
    `;
    const query =`INSERT INTO user_wiegands
(sn, user_id, group_id, group_uuid, timestamp, del_flag)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT ON CONSTRAINT unique_user_device
DO UPDATE SET
  group_id = EXCLUDED.group_id,
  group_uuid = EXCLUDED.group_uuid,
  timestamp = EXCLUDED.timestamp,
  del_flag = EXCLUDED.del_flag
RETURNING *`;

    const values = [
      sn,
      user_id,
      group_id,
      existWiegandGrp.rows[0].id,
      timestamp,
      del_flag
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add UserWiegand Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getUserWiegand = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      del_flag,
      sort_by = "timestamp",
      sort_order = "DESC"
    } = req.query;

    // ---- Pagination ----
    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    // ---- Sorting ----
    const validSortColumns = ["user_id", "sn", "group_id", "timestamp"];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "timestamp";

    const sortDirection =
      sort_order && sort_order.toUpperCase() === "ASC"
        ? "ASC"
        : "DESC";

    // ---- Dynamic WHERE ----
    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    // del_flag filter (convert string to boolean properly)
    if (del_flag !== undefined) {
      const parsedFlag =
        del_flag === "true" || del_flag === true
          ? true
          : del_flag === "false" || del_flag === false
            ? false
            : null;

      if (parsedFlag !== null) {
        whereClauses.push(`del_flag = $${paramIndex}`);
        values.push(parsedFlag);
        paramIndex++;
      }
    }

    // Search filter
    if (search) {
      whereClauses.push(`(
        CAST(user_id AS TEXT) ILIKE $${paramIndex}
        OR sn ILIKE $${paramIndex}
        OR group_id ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // ---- Data Query ----
    const dataQuery = `
  SELECT 
    uw.*,
    d.device_name
  FROM user_wiegands uw
  LEFT JOIN devices d 
    ON uw.sn = d.sn
  ${whereSQL}
  ORDER BY ${sortColumn} ${sortDirection}
  LIMIT $${paramIndex}
  OFFSET $${paramIndex + 1};
`;

    values.push(limit);
    values.push(offset);

    // ---- Count Query ----
    const countQuery = `
      SELECT COUNT(*) 
      FROM user_wiegands
      ${whereSQL};
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, values.slice(0, paramIndex - 1))
    ]);

    const totalRecords = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      success: true,
      total_records: totalRecords,
      current_page: page,
      total_pages: Math.ceil(totalRecords / limit),
      data: dataResult.rows
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.softDeleteUserWiegand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    // Check if exists and not already deleted
    const checkQuery = `
      SELECT id 
      FROM user_wiegands
      WHERE id = $1 AND del_flag = false
    `;

    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    // Soft delete
    const updateQuery = `
      UPDATE user_wiegands
      SET del_flag = true
      WHERE id = $1
      RETURNING *;
    `;

    const updateResult = await pool.query(updateQuery, [id]);

    return res.status(200).json({
      success: true,
      message: "User Wiegand soft deleted successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error("软删除用户韦根关联失败：", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateUserWiegand1 = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { sn, user_id, group_id } = req.body;
    const timestamp = Math.floor(Date.now() / 1000)
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    await client.query("BEGIN");

    // Check if record exists and not deleted
    const existing = await client.query(
      `SELECT * FROM user_wiegands 
       WHERE id = $1 AND del_flag = false`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    let group_uuid = existing.rows[0].group_uuid;

    // If group_id provided → validate & fetch uuid
    if (group_id) {
      const groupResult = await client.query(
        `SELECT id FROM wiegand_groups WHERE group_id = $1`,
        [group_id]
      );

      if (groupResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Group not found"
        });
      }

      group_uuid = groupResult.rows[0].id;
    }

    // Prevent duplicate (user_id + group_id)
    if (user_id || group_id) {
      const duplicateCheck = await client.query(
        `SELECT id FROM user_wiegands
         WHERE user_id = $1 
         AND group_id = $2
         AND id != $3`,
        [
          user_id || existing.rows[0].user_id,
          group_id || existing.rows[0].group_id,
          id
        ]
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "User already assigned to this group"
        });
      }
    }

    // Build dynamic update
    const updateQuery = `
      UPDATE user_wiegands
      SET
        sn = COALESCE($1, sn),
        user_id = COALESCE($2, user_id),
        group_id = COALESCE($3, group_id),
        group_uuid = COALESCE($4, group_uuid),
        timestamp = COALESCE($5, timestamp)
      WHERE id = $6
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, [
      sn || null,
      user_id || null,
      group_id || null,
      group_id ? group_uuid : null,
      timestamp ? Number(timestamp) : null,
      id
    ]);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "User Wiegand updated successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update UserWiegand Error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry not allowed"
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};

exports.updateUserWiegand = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { sn, user_id, group_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    // const timestamp = Math.floor(Date.now() / 1000);
    const timestamp = Date.now();

    await client.query("BEGIN");

    // -----------------------------------
    // 1️⃣ Check existing record
    // -----------------------------------
    const existing = await client.query(
      `SELECT * 
       FROM user_wiegands
       WHERE id = $1 AND del_flag = false`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    const current = existing.rows[0];

    let newSn = sn || current.sn;
    let newUserId = user_id || current.user_id;
    let newGroupId = group_id || current.group_id;
    let group_uuid = current.group_uuid;

    // -----------------------------------
    // 2️⃣ Validate group if changed
    // -----------------------------------
    if (group_id) {
      const groupResult = await client.query(
        `SELECT id 
         FROM wiegand_groups
         WHERE group_id = $1`,
        [group_id]
      );

      if (groupResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Group not found"
        });
      }

      group_uuid = groupResult.rows[0].id;
    }

    // -----------------------------------
    // 3️⃣ Prevent duplicate (user + device)
    // -----------------------------------
    const duplicateCheck = await client.query(
      `SELECT id
       FROM user_wiegands
       WHERE user_id = $1
       AND sn = $2
       AND id != $3`,
      [newUserId, newSn, id]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "User already assigned to this device"
      });
    }

    // -----------------------------------
    // 4️⃣ Update record
    // -----------------------------------
    const updateResult = await client.query(
      `
      UPDATE user_wiegands
      SET
        sn = $1,
        user_id = $2,
        group_id = $3,
        group_uuid = $4,
        timestamp = $5
      WHERE id = $6
      RETURNING *;
      `,
      [
        newSn,
        newUserId,
        newGroupId,
        group_uuid,
        timestamp,
        id
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "User Wiegand updated successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update UserWiegand Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};





