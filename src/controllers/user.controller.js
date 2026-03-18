const { pool } = require("../config/database")
const userData = require("../data/data")
const { validationResult } = require("express-validator")
const fs = require('fs');
const path = require('path');
const ERR = require("../utils/errorCodes");

exports.fetchAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role,
      sn,
      user_id,
      sort_by = "created_at",
      sort_order = "desc"
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Allowed sort columns
    const validSortColumns = [
      "name", "email", "role", "sn", "user_id",
      "created_at", "updated_at"
    ];

    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";

    const sortDirection = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // WHERE clause builder
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Search (name/email)
    if (search.trim()) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.user_id ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Filter: role
    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    // Filter: sn
    if (sn) {
      whereConditions.push(`sn = $${paramIndex}`);
      params.push(sn);
      paramIndex++;
    }

    // Filter: user_id
    if (user_id) {
      whereConditions.push(`user_id = $${paramIndex}`);
      params.push(user_id);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    // Fetch users with sort + pagination
    const dataQuery1 = `
      SELECT 
        u.id, u.name, u.email, u.role, u.sn, u.user_id,u.phone_number,
         u.wiegand_flag, u.admin_auth,d.device_name,
        u.created_at, u.updated_at, uw.group_id,wg.sn,wg.time_configs
      FROM users u
      LEFT JOIN devices d ON u.sn = d.sn
      LEFT JOIN user_wiegands uw ON u.user_id = uw.user_id
      LEFT JOIN wiegand_groups wg ON uw.group_uuid = wg.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataQuery = `SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.sn,
  u.user_id,
  u.phone_number,
  u.wiegand_flag,
  u.admin_auth,
  d.device_name,
  u.created_at,
  u.updated_at,

  COALESCE(
    json_agg(
      json_build_object(
        'group_id', wg.group_id,
        'time_configs', wg.time_configs
      )
    ) FILTER (WHERE wg.id IS NOT NULL),
    '[]'
  ) AS groups

FROM users u
LEFT JOIN devices d ON u.sn = d.sn
LEFT JOIN user_wiegands uw ON u.user_id = uw.user_id
LEFT JOIN wiegand_groups wg ON uw.group_uuid = wg.id

${whereClause}

GROUP BY
  u.id,
  d.device_name

ORDER BY ${sortColumn} ${sortDirection}
LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`


    params.push(limitNum, offset);

    // Count total rows (without pagination)
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM users u
      ${whereClause}
    `;

    // Execute queries
    const dataResult = await pool.query(dataQuery, params);
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    const total = parseInt(countResult.rows[0].total, 10);

    return res.status(200).json({
      code: 0,
      msg: "success",
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("fetchAllUsers error:", error);
    return res.status(500).json({
      code: 1,
      msg: "internal server error",
    });
  }
};

exports.fetchAllUsersWithGroup1 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role,
      sn,
      user_id,
      sort_by = "created_at",
      sort_order = "desc"
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Allowed sort columns
    const validSortColumns = [
      "name", "email", "role", "sn", "user_id",
      "created_at", "updated_at"
    ];

    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";

    const sortDirection = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // WHERE clause builder
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Search (name/email)
    if (search.trim()) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Filter: role
    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    // Filter: sn
    if (sn) {
      whereConditions.push(`sn = $${paramIndex}`);
      params.push(sn);
      paramIndex++;
    }

    // Filter: user_id
    if (user_id) {
      whereConditions.push(`user_id = $${paramIndex}`);
      params.push(user_id);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    // Fetch users with sort + pagination
    const dataQuery = `
  SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.sn,
    u.user_id,
    u.wiegand_flag,
    u.admin_auth,
    u.created_at,
    u.updated_at,

    COUNT(DISTINCT gu.group_id) AS group_count,

    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'group_id', gu.id,
          'common_group', g.id,
          'group_name', g.group_name
        )
      ) FILTER (WHERE g.id IS NOT NULL),
      '[]'
    ) AS groups

  FROM users u
  LEFT JOIN group_users gu ON gu.user_id = u.id
  LEFT JOIN access_groups g ON g.id = gu.group_id

  ${whereClause}

  GROUP BY u.id
  ORDER BY ${sortColumn} ${sortDirection}
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`;

    params.push(limitNum, offset);

    // Count total rows (without pagination)
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM users
      ${whereClause}
    `;

    // Execute queries
    const dataResult = await pool.query(dataQuery, params);
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    const total = parseInt(countResult.rows[0].total, 10);

    return res.status(200).json({
      code: 0,
      msg: "success",
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("fetchAllUsers error:", error);
    return res.status(500).json({
      code: 1,
      msg: "internal server error",
    });
  }
};

exports.fetchAllUsersWithGroup = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
      role
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;
    const orderDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const params = [];
    let idx = 1;

    /* ---------- WHERE (applies to base users table) ---------- */
    let whereClause = `WHERE master_user_id IS NOT NULL`;

    if (search.trim()) {
      whereClause += `
        AND (
          name ILIKE $${idx}
          OR email ILIKE $${idx}
        )
      `;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    if (role) {
      whereClause += ` AND role = $${idx}`;
      params.push(role);
      idx++;
    }

    /* ---------- QUERY ---------- */
    const query = `
      SELECT
        u.master_user_id,
        u.id,
        u.name,
        u.email,
        u.role,
        u.wiegand_flag,
        u.admin_auth,
        u.created_at,
        u.updated_at,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', d.id,
              'sn', d.sn,
              'name', d.device_name,
              'ip', d.device_ip,
              'online', d.online_status,
              'last_connect', d.last_connect_time,
              'firmware', d.firmware_version
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS devices,

        COUNT(*) OVER() AS total_count

      FROM (
        /* ONE row per logical user */
        SELECT DISTINCT ON (master_user_id)
          id,
          master_user_id,
          name,
          email,
          role,
          wiegand_flag,
          admin_auth,
          created_at,
          updated_at
        FROM users
        ${whereClause}
        ORDER BY master_user_id, created_at DESC
      ) u

      /* JOIN ALL device-related user rows */
      LEFT JOIN users u_all
        ON u_all.master_user_id = u.master_user_id

      LEFT JOIN devices d
        ON d.sn = u_all.sn

      GROUP BY
        u.master_user_id,
        u.id,
        u.name,
        u.email,
        u.role,
        u.wiegand_flag,
        u.admin_auth,
        u.created_at,
        u.updated_at

      ORDER BY
        ${sortBy === 'name' ? 'u.name' :
        sortBy === 'email' ? 'u.email' :
          sortBy === 'role' ? 'u.role' :
            'u.created_at'
      } ${orderDir}

      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    params.push(limitNum, offset);

    const { rows } = await pool.query(query, params);

    const total = rows.length ? Number(rows[0].total_count) : 0;

    return res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        master_user_id: r.master_user_id,
        name: r.name,
        email: r.email,
        role: r.role,
        wiegand_flag: r.wiegand_flag,
        admin_auth: r.admin_auth,
        created_at: r.created_at,
        updated_at: r.updated_at,
        devices: r.devices
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("fetchAllUsersWithGroup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

exports.fetchSingleUsersWithGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        code: 1,
        msg: "User id is required"
      });
    }
    const result = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: 1,
        msg: "User not found"
      });
    }

    return res.status(200).json({
      code: 0,
      msg: "User and related groups fetch successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("fetchUsersWithGroup error:", error);
    return res.status(500).json({
      code: 1,
      msg: "Internal server error"
    });
  }
};

exports.deleteUsersWithGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        code: 1,
        msg: "User id is required"
      });
    }

    // get user first
    const userResult = await pool.query(
      `SELECT user_id FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        code: 1,
        msg: "User not found"
      });
    }

    const userId = userResult.rows[0].user_id;

    // delete user_wiegands
    await pool.query(
      `DELETE FROM user_wiegands WHERE user_id = $1`,
      [userId]
    );

    // delete user
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, name, email`,
      [id]
    );

    return res.status(200).json({
      code: 0,
      msg: "User and related groups deleted successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("deleteUsersWithGroup error:", error);
    return res.status(500).json({
      code: 1,
      msg: "Internal server error"
    });
  }
};


exports.addUserData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ ...ERR.PARAM_ERROR, errors: errors.array() });
    }
    // const { sn, id, name, image_left, image_right, wiegand_flag = 0, admin_auth = 0 } = req.body;

    const { sn, id, name, image_left, image_right, wiegand_flag = 0, admin_auth = 0 } = req.body;
    // 1. Basic validation
    if (!sn || !id || !name || !image_left || !image_right) {
      return res.json({ code: 1, msg: "Missing required fields" });
    }

    // 2. Optional: Save raw files for debugging
    const saveDir = path.join(__dirname, '../../uploads/palm_raw');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    const timestamp = Date.now();
    const saveFile = (base64, side) => {
      try {
        const buffer = Buffer.from(base64.split('base64,')[1] || base64, 'base64');
        const filename = `${sn}_${id}_${side}_${timestamp}.raw`;
        fs.writeFileSync(path.join(saveDir, filename), buffer);
      } catch (e) {
        console.warn("Save raw failed:", e.message);
      }
    };

    saveFile(image_left, 'left');
    saveFile(image_right, 'right');

    // 3. Check if already registered on this device
    const { rows: exists } = await pool.query(
      `SELECT 1 FROM users WHERE sn = $1 AND user_id = $2 LIMIT 1`,
      [sn, id]
    );

    if (exists.length > 0) {
      return res.json({ code: 1, msg: "User already registered on this device" });
    }
    // const defaultShift = await pool.query(
    //   `SELECT id FROM shifts WHERE is_active = true LIMIT 1`
    // );

    // 4. Save to database (raw base64 - same as old system)
    const insertRes = await pool.query(`
      INSERT INTO users (
        sn,role, user_id, name,
        image_left, image_right,
        wiegand_flag, admin_auth,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7,$8, NOW(), NOW())
       RETURNING id
    `, [sn, role = "inmate", id, name, image_left, image_right, wiegand_flag, admin_auth]);

    const generatedId = insertRes.rows[0].id;

    await pool.query(
      `
  UPDATE users
  SET master_user_id = $1
  WHERE id = $2
  `,
      [generatedId, generatedId]
    );

    return res.json({ code: 0, msg: "success" });

  } catch (error) {
    return res.json({ code: 1, msg: "Registration failed" });
  }
};

exports.updateUsersPersmissions = async (req, res) => {
  try {
    const { wiegand_flag } = req.body;
    const { id } = req.params

    const userData = await pool.query(`UPDATE users SET wiegand_flag=$1 ,updated_at = now() WHERE id = $2`, [wiegand_flag, id])

    return res.json({ status: true, message: "updated successfully" });

  } catch (error) {
    console.log("<><>error", error)
  }
};

exports.updateUsersDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Check if user exists
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [id]
    );

    if (userCheck.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Validate shift_id if present
    if (data.shift_id) {
      const shiftCheck = await pool.query(
        `SELECT id FROM shifts WHERE id = $1 AND is_active = true`,
        [data.shift_id]
      );

      if (shiftCheck.rows.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Invalid or inactive shift_id"
        });
      }
    }

    // Check duplicate email
    if (data.email) {
      const emailCheck = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [data.email, id]
      );

      if (emailCheck.rowCount > 0) {
        return res.status(400).json({
          status: false,
          message: "Email already exists"
        });
      }
    }

    // Check duplicate phone number
    if (data.phone_number) {
      const phoneCheck = await pool.query(
        `SELECT id FROM users WHERE phone_number = $1 AND id != $2`,
        [data.phone_number, id]
      );

      if (phoneCheck.rowCount > 0) {
        return res.status(400).json({
          status: false,
          message: "Phone number already exists"
        });
      }
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let index = 1;
    for (const key in data) {
      fields.push(`${key} = $${index}`);
      values.push(data[key]);
      index++;
    }

    if (fields.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No fields provided for update"
      });
    }

    const query = `
      UPDATE users
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${index}
      RETURNING *
    `;

    values.push(id);

    const result = await pool.query(query, values);

    return res.json({
      status: true,
      message: "User updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("updateUsersDetails error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
