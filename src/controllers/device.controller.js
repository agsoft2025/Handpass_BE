const { pool } = require("../config/database");
const { connectDevice, addInmateService } = require("../services/device.service");
const { validationResult } = require("express-validator");
const ERR = require("../utils/errorCodes");
const deviceLastConnectTime = new Map();

// exports.connectDeviceController = async(req , res)=>{
//   // const { id } = req.user
//    try {
//     const { sn } = req.body;

//     if (!sn) {
//       return res.status(400).json({ status: 1, msg: "sn is required" });
//     }

//     // Extract device IP (format fix for ::ffff:127.0.0.1)
//     const deviceIp = req.ip.replace("::ffff:", "");

//     const result = await connectDevice(sn, deviceIp,id);

//     res.json(result);
//   } catch (error) {
//     console.error("Connect API error:", error);
//     res.status(500).json({ status: 1, msg: "internal server error" });
//   }
// }
// exports.connectDeviceController = async (req, res) => {
//   try {
//     const { sn } = req.body;

//     if (!sn) {
//       return res.status(400).json({ code: 1, msg: "sn is required" });
//     }

//     const deviceIp = req.ip.replace("::ffff:", "");

//     await connectDevice(sn, deviceIp);

//     return res.json({ code: 0, msg: "success" });

//   } catch (error) {
//     console.error("Connect API error:", error);
//     return res.status(500).json({ code: 1, msg: "internal server error" });
//   }
// };

exports.connectDeviceController = async (req, res) => {
  try {
    const { sn } = req.body;

    if (!sn || typeof sn !== 'string' || sn.trim() === '') {
      return res.status(400).json({
        code: 1,
        msg: "Device serial number (sn) is required and cannot be empty"
      });
    }

    // Clean IP: remove ::ffff: prefix (common in Node.js with IPv6)
    let deviceIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
    if (deviceIp?.includes('::ffff:')) {
      deviceIp = deviceIp.split('::ffff:')[1];
    }
    // Fallback to 'unknown' or null if still invalid
    deviceIp = deviceIp && deviceIp !== '::1' ? deviceIp : null;

    const result = await connectDevice(sn.trim(), deviceIp);
    return res.json({
      code: 0,
      msg: "success",
      data: { sn, online: true, ip: deviceIp, device: result.data[0] }
    });

  } catch (error) {
    console.error('Device connect error:', error);
    return res.status(500).json({
      code: 1,
      msg: "Failed to connect device"
    });
  }
};

exports.fetchAllConnectDevices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, sort_by = "created_at", sort_order = "DESC" } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let idx = 1;
    if (search) {
      where.push(`(sn ILIKE $${idx} OR device_name ILIKE $${idx} OR device_ip ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (status === "0" || status === "1") {
      where.push(`online_status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const allowedSort = ["sn", "device_name", "device_ip", "online_status", "created_at", "updated_at"];
    const sortField = allowedSort.includes(sort_by) ? sort_by : "created_at";
    const sortOrder = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const query = `
      SELECT id, sn, device_name, device_ip, online_status,
             last_connect_time, firmware_version,
             created_at, updated_at
      FROM devices
      ${whereSQL}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const dataParams = [...params, limit, offset];

    const devices = await pool.query(query, dataParams);

    const totalQuery = `
      SELECT COUNT(*) AS total
      FROM devices
      ${whereSQL}
    `;

    const total = await pool.query(totalQuery, params);

    return res.json({
      status: true,
      message: "Devices fetched successfully",
      pagination: {
        total: Number(total.rows[0].total),
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total.rows[0].total / limit)
      },
      data: devices.rows
    });

  } catch (error) {
    return res.status(500).send({ status: false, message: "internal server down" })
  }
}

exports.updateDeviceStatus = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ ...ERR.PARAM_ERROR, errors: errors.array() });
    }

    const { sn, online_status, device_ip = "" } = req.body;
    const now = new Date();

    // 1️⃣ Check if device already exists
    const existing = await pool.query(
      `SELECT * FROM devices WHERE sn = $1 LIMIT 1`,
      [sn]
    );

    let isNew = false;
    let device;

    if (existing.rows.length === 0) {
      // 2️⃣ Device not found → Auto-register
      const insert = await pool.query(
        `
        INSERT INTO devices (sn, device_ip, online_status, last_connect_time)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [sn, device_ip, online_status, now]
      );

      device = insert.rows[0];
      isNew = true;

    } else {
      // 3️⃣ Device found → Update fields
      const update = await pool.query(
        `
        UPDATE devices 
        SET 
          online_status = $1,
          device_ip = $2,
          last_connect_time = $3,
          updated_at = now()
        WHERE sn = $4
        RETURNING *
        `,
        [online_status, device_ip, now, sn]
      );

      device = update.rows[0];
    }

    return res.json({
      ...ERR.SUCCESS,
      data: { device, isNew }
    });

  } catch (error) {
    console.error("Error updating device status:", error);

    return res.json({
      ...ERR.DB_UPDATE_ERROR,
      msg: `Device status update failed: ${error.message}`
    });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const body = req.body;

    if (!id) {
      return res.status(400).json({ status: false, message: "Device ID required" });
    }

    let setQuery = "";
    let values = [];
    let i = 1;

    // 🔥 IF case updates (no loops)
    if (body.sn) {
      setQuery += `sn = $${i}, `;
      values.push(body.sn);
      i++;
    }

    if (body.device_name) {
      setQuery += `device_name = $${i}, `;
      values.push(body.device_name);
      i++;
    }

    if (body.device_ip) {
      setQuery += `device_ip = $${i}, `;
      values.push(body.device_ip);
      i++;
    }

    if (body.online_status !== undefined) {
      setQuery += `online_status = $${i}, `;
      values.push(body.online_status);
      i++;
    }

    if (body.firmware_version) {
      setQuery += `firmware_version = $${i}, `;
      values.push(body.firmware_version);
      i++;
    }

    // Nothing to update
    if (setQuery === "") {
      return res.status(400).json({
        status: false,
        message: "No fields to update"
      });
    }


    setQuery += `updated_at = now()`;

    // WHERE condition
    values.push(id);

    const query = `
      UPDATE devices
      SET ${setQuery}
      WHERE id = $${i}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ status: false, message: "Device not found" });
    }

    return res.json({
      status: true,
      message: "Device updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("🔥 updateDevice error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};

exports.fetchSingleDevice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Device ID is required" });
    }

    const result = await pool.query(
      `SELECT *
       FROM devices
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Device not found" });
    }

    return res.json({
      status: true,
      message: "Device fetched successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("🔥 fetchSingleDevice Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Device ID is required" });
    }

    // Check if device exists
    const check = await pool.query(
      `SELECT id FROM devices WHERE id = $1`,
      [id]
    );

    if (check.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Device not found" });
    }

    // Delete device
    await pool.query(
      `DELETE FROM devices WHERE id = $1`,
      [id]
    );

    return res.json({
      status: true,
      message: "Device deleted successfully",
    });

  } catch (error) {
    console.error("🔥 deleteDevice Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};


exports.addUserToDeviceController = async (req, res) => {
  try {
    const result = await addInmateService(req.body);
    return res.json(result);
  } catch (error) {
    console.error("Error in /v1/add:", error);
    return res.status(500).json({ status: 1, msg: "Server Error" });
  }
}

exports.deviceGetUsers1 = async (req, res) => {
  try {
    const { sn, page = 1, limit = 10, search = "", sortBy = "user_id", sortOrder = "ASC" } = req.body;

    if (!sn) {
      return res.status(400).json({ code: 1, msg: "sn is required" });
    }

    // Pagination values
    const offset = (page - 1) * limit;

    // Build dynamic conditions
    let query = `
      SELECT 
      id,
        user_id,
        name,
        wiegand_flag,
        admin_auth,
        image_left,
        image_right
      FROM users
      WHERE sn = $1
    `;

    let params = [sn];

    // Search
    if (search) {
      params.push(`%${search}%`);
      query += ` AND name ILIKE $${params.length}`;
    }

    // Sorting
    const validSortColumns = ["user_id", "name"];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : "user_id";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    // Pagination
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Fetch users
    const result = await pool.query(query, params);
    const users = result.rows;

    // Count total users for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE sn = $1`,
      [sn]
    );

    const totalCount = parseInt(countResult.rows[0].count);

    // Convert RAW 768x988 grayscale → PNG base64
    const convertRawToPngBase64 = async (rawBase64) => {
      try {
        if (!rawBase64) return null;

        const cleanBase64 = rawBase64.includes("base64,")
          ? rawBase64.split("base64,")[1]
          : rawBase64;

        const buffer = Buffer.from(cleanBase64, "base64");

        if (buffer.length !== 758784) return null;

        const pngBuffer = await sharp(buffer, {
          raw: { width: 768, height: 988, channels: 1 },
        }).png().toBuffer();

        return `data:image/png;base64,${pngBuffer.toString("base64")}`;
      } catch {
        return null;
      }
    };

    // Process images
    const processedUsers = await Promise.all(
      users.map(async (user) => ({
        id: user.id,
        user_id: user.user_id,
        name: user.name,
        wiegand_flag: user.wiegand_flag,
        admin_auth: user.admin_auth,
        // image_left: await convertRawToPngBase64(user.image_left),
        // image_right: await convertRawToPngBase64(user.image_right),
        image_right: user.image_right,
        image_left: user.image_left
      }))
    );

    return res.json({
      code: 0,
      msg: "success",
      data: {
        users: processedUsers,
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    });

  } catch (error) {
    console.error("deviceGetUsers error:", error);
    return res.status(500).json({ code: 1, msg: "Server error", error: error.message });
  }
};

exports.deviceGetUsers1 = async (req, res) => {
  try {
    const { sn, page = 1, limit = 10, search = "", sortBy = "user_id", sortOrder = "ASC" } = req.body;

    if (!sn) {
      return res.status(400).json({ code: 1, msg: "sn is required" });
    }

    const offset = (page - 1) * limit;

    // -----------------------------------------------------
    // 1. Get device_id using sn
    // -----------------------------------------------------
    const deviceRes = await pool.query(
      `SELECT id FROM devices WHERE sn = $1`,
      [sn]
    );

    if (deviceRes.rowCount === 0) {
      return res.json({ code: 1, msg: "Device not found" });
    }

    const deviceId = deviceRes.rows[0].id;

    // -----------------------------------------------------
    // 2. Get group_id for this device
    // (Assuming 1 device = 1 group as you said)
    // -----------------------------------------------------
    const groupRes = await pool.query(
      `SELECT id FROM access_groups WHERE device_id = $1 LIMIT 1`,
      [deviceId]
    );

    if (groupRes.rowCount === 0) {
      return res.json({ code: 1, msg: "No group found for this device" });
    }

    const groupId = groupRes.rows[0].id;

    // -----------------------------------------------------
    // 3. Fetch user list from this group
    // -----------------------------------------------------
    let query = `
      SELECT 
        u.id,
        u.user_id,
        u.name,
        u.wiegand_flag,
        u.admin_auth,
        u.image_left,
        u.image_rightx
      FROM group_users gu
      JOIN users u ON u.id = gu.user_id
      WHERE gu.group_id = $1
    `;

    let params = [groupId];

    // Search
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.user_id ILIKE $${params.length})`;
    }

    // Sorting
    const validSortColumns = ["user_id", "name"];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : "user_id";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    // Pagination
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    const users = result.rows;

    // -----------------------------------------------------
    // 4. Count total
    // -----------------------------------------------------
    const countRes = await pool.query(
      `
      SELECT COUNT(*) 
      FROM group_users gu 
      JOIN users u ON u.id = gu.user_id
      WHERE gu.group_id = $1
        AND (
          u.name ILIKE $2 OR u.user_id ILIKE $2
        )
      `,
      [groupId, `%${search}%`]
    );

    const totalCount = parseInt(countRes.rows[0].count);

    // -----------------------------------------------------
    // 5. Return expected output
    // -----------------------------------------------------

    return res.json({
      code: 0,
      msg: "success",
      data: {
        users: users.map((u) => ({
          id: u.id,
          user_id: u.user_id,
          name: u.name,
          wiegand_flag: u.wiegand_flag,
          admin_auth: u.admin_auth,
          image_left: u.image_left,
          image_right: u.image_right
        })),
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error("deviceGetUsers error:", error);
    return res.status(500).json({ code: 1, msg: "Server error", error: error.message });
  }
};

exports.deviceGetUsers = async (req, res) => {
  try {
    const {
      sn,
      page = 1,
      limit = 10,
      search = "",
      sortBy = "user_id",
      sortOrder = "ASC"
    } = req.body;

    if (!sn) {
      return res.status(400).json({ code: 1, msg: "sn is required" });
    }

    const offset = (page - 1) * limit;

    // ------------------------------------------
    // 1️⃣ Get group IDs for this device
    // ------------------------------------------
    const groupRes = await pool.query(
      `SELECT id FROM wiegand_groups WHERE sn = $1 AND del_flag = false`,
      [sn]
    );

    if (groupRes.rowCount === 0) {
      return res.json({ code: 1, msg: "No group found for this device" });
    }

    const groupIds = groupRes.rows.map(g => g.id);

    // ------------------------------------------
    // 2️⃣ Fetch users using user_wiegands mapping
    // ------------------------------------------
    let query = `
      SELECT 
        u.id,
        u.user_id,
        u.name,
        u.wiegand_flag,
        u.admin_auth
      FROM user_wiegands uw
      JOIN users u ON u.id = uw.user_id
      WHERE uw.group_uuid = ANY($1)
        AND uw.del_flag = false
        AND u.del_flag = false
    `;

    let params = [groupIds];

    // Search
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.user_id ILIKE $${params.length})`;
    }

    // Sorting
    const validSortColumns = ["user_id", "name"];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : "user_id";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    query += ` ORDER BY u.${safeSortBy} ${safeSortOrder}`;

    // Pagination
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // ------------------------------------------
    // 3️⃣ Count total
    // ------------------------------------------
    let countQuery = `
      SELECT COUNT(*)
      FROM user_wiegands uw
      JOIN users u ON u.id = uw.user_id
      WHERE uw.group_uuid = ANY($1)
        AND uw.del_flag = false
        AND u.del_flag = false
    `;

    let countParams = [groupIds];

    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (u.name ILIKE $2 OR u.user_id ILIKE $2)`;
    }

    const countRes = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countRes.rows[0].count);

    return res.json({
      code: 0,
      msg: "success",
      data: {
        users: result.rows,
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error("deviceGetUsers error:", error);
    return res.status(500).json({
      code: 1,
      msg: "Server error",
      error: error.message
    });
  }
};






exports.getPassRecordsByDeviceSn = async (req, res) => {
  try {
    // Validate request
    if (!req.body || !req.body.sn) {
      return res.json({ ...ERR.PARAM_ERROR, errors: "missing fn field" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ ...ERR.PARAM_ERROR, errors: errors.array() });
    }

    const { sn } = req.body;

    // Query device access logs
    const result = await pool.query(
      `
      SELECT 
        id, 
        sn, 
        name, 
        user_id, 
        palm_type, 
        device_date_time, 
        created_at
      FROM device_access_logs
      WHERE sn = $1
      ORDER BY device_date_time DESC
      `,
      [sn]
    );

    return res.json({
      ...ERR.SUCCESS,
      data: {
        passRecordList: result.rows,
        count: result.rowCount
      }
    });

  } catch (error) {
    console.error("Error querying access records by device:", error);

    return res.json({
      ...ERR.DB_QUERY_ERROR,
      msg: `Access record query failed: ${error.message}`
    });
  }
};


exports.connect = async (req, res) => {
  try {
    // -----------------------------
    // Validate request
    // -----------------------------
    if (!req.body || !req.body.sn) {
      return res.json({
        ...ERR.PARAM_ERROR,
        error: "missing sn field"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }
    const { sn } = req.body;

    // -----------------------------
    // Get Client IP
    // -----------------------------
    let clientIp = req.ip || req.connection.remoteAddress || null;

    if (clientIp && clientIp.includes("::ffff:")) {
      clientIp = clientIp.split("::ffff:")[1];
    }

    const currentTime = Date.now();
    deviceLastConnectTime.set(sn, currentTime);

    // -----------------------------
    // Upsert Device
    // -----------------------------
    const checkDevice = await pool.query(
      `SELECT id FROM devices WHERE sn = $1`,
      [sn]
    );
    if (checkDevice.rowCount > 0) {
      await pool.query(
        `
        UPDATE devices
        SET online_status = 1,
            device_ip = $1,
            last_connect_time = NOW(),
            updated_at = NOW()
        WHERE sn = $2
        `,
        [clientIp, sn]
      );
    } else {
      await pool.query(
        `
        INSERT INTO devices
        (sn, online_status, device_ip, last_connect_time, created_at, updated_at)
        VALUES
        ($1, 1, $2, NOW(), NOW(), NOW())
        `,
        [sn, clientIp]
      );
    }

    // -----------------------------
    // 1️⃣ Users max updated_at (ms)
    // -----------------------------
    const userMaxResult1 = await pool.query(
      `
      SELECT COALESCE(
        MAX(EXTRACT(EPOCH FROM updated_at) * 1000),
        0
      ) AS max_ts
      FROM users
      WHERE sn = $1
      `,
      [sn]
    );

        const userMaxResult = await pool.query(
      `
      SELECT COALESCE(
        MAX(EXTRACT(EPOCH FROM updated_at) * 1000),
        0
      ) AS max_ts
      FROM users
      `,
    );

    const register_timestamp =
      Math.floor(userMaxResult.rows[0].max_ts || 0).toString();
    // -----------------------------
    // 2️⃣ Wiegand Groups max timestamp
    // -----------------------------
    const groupMaxResult = await pool.query(
      `
      SELECT COALESCE(MAX(timestamp), 0) AS max_ts
      FROM wiegand_groups
      WHERE sn = $1
      `,
      [sn]
    );

    const wiegand_group_timestamp =
      groupMaxResult.rows[0].max_ts
        ? groupMaxResult.rows[0].max_ts.toString()
        : "0";

    // -----------------------------
    // 3️⃣ User Wiegand max timestamp
    // -----------------------------
    const userWiegandMaxResult = await pool.query(
      `
      SELECT COALESCE(MAX(timestamp), 0) AS max_ts
      FROM user_wiegands
      WHERE sn = $1
      `,
      [sn]
    );

    const user_wiegand_timestamp =
      userWiegandMaxResult.rows[0].max_ts
        ? userWiegandMaxResult.rows[0].max_ts.toString()
        : "0";

    // -----------------------------
    // Final Response
    // -----------------------------
    return res.json({
      ...ERR.SUCCESS,
      register_timestamp,
      wiegand_group_timestamp,
      user_wiegand_timestamp
    });

  } catch (error) {
    console.error("Device connect error:", error);

    return res.json({
      ...ERR.NETWORK_ERROR,
      register_timestamp: "0",
      wiegand_group_timestamp: "0",
      user_wiegand_timestamp: "0"
    });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    // ----------------------------------------
    // 1. Validate Request Body
    // ----------------------------------------
    if (!req.body || !req.body.sn || !req.body.id) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, id"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    // ----------------------------------------
    // 2. Extract Payload
    // ----------------------------------------
    const { sn, id: studentId } = req.body;

    // ----------------------------------------
    // 3. Find User (user_id + sn)
    // ----------------------------------------
    const findUser = await pool.query(
      `
      SELECT * 
      FROM users 
      WHERE user_id = $1 AND sn = $2 
      LIMIT 1
      `,
      [studentId, sn]
    );

    if (findUser.rows.length === 0) {
      return res.json({ ...ERR.DB_ID_NOT_EXIST });
    }

    // ----------------------------------------
    // 4. Delete User
    // ----------------------------------------
    await pool.query(
      `
      DELETE FROM users 
      WHERE user_id = $1 AND sn = $2
      `,
      [studentId, sn]
    );

    // ----------------------------------------
    // 5. Return Success
    // ----------------------------------------
    return res.json({ ...ERR.SUCCESS });

  } catch (error) {
    console.error("Delete user error:", error);

    return res.json({
      ...ERR.DB_DELETE_ERROR,
      msg: `User deletion failed: ${error.message}`
    });
  }
};

exports.queryUsers1 = async (req, res) => {
  try {
    // ------------------------------------
    // 1. Validate Body
    // ------------------------------------
    if (!req.body || !req.body.sn) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required field: sn"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    const { sn } = req.body;

    // ------------------------------------
    // 2. Fetch Users for This Device SN
    // user_id → id (alias)
    // ------------------------------------
    const result = await pool.query(
      `
      SELECT 
        user_id AS id,
        wiegand_flag,
        admin_auth
      FROM users
      WHERE sn = $1
      `,
      [sn]
    );

    // ------------------------------------
    // 3. Return Response
    // ------------------------------------
    return res.json({
      ...ERR.SUCCESS,
      data: { idDataList: result.rows }
    });

  } catch (error) {
    console.error("Query users error:", error);

    return res.json({
      ...ERR.DB_QUERY_ERROR,
      msg: `User query failed: ${error.message}`
    });
  }
};

exports.queryUsers = async (req, res) => {
  try {
    // ------------------------------------
    // 1. Validate Body
    // ------------------------------------
    if (!req.body || !req.body.sn) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required field: sn"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    const { sn, device_timestamp } = req.body;
    // Force numeric (avoid injection + type issue)
    const deviceTs = parseInt(device_timestamp, 10) || 0;

    // ------------------------------------
    // 2. Query Users (Only updated after device timestamp)
    // ------------------------------------
       const query1 = `SELECT
  uw.user_id AS id,
  u.wiegand_flag,
  u.admin_auth,
  uw.del_flag,
  GREATEST(
      uw.timestamp,
      EXTRACT(EPOCH FROM u.updated_at) * 1000
  ) AS timestamp
FROM user_wiegands uw
JOIN users u ON u.user_id = uw.user_id
WHERE uw.sn = $1
AND GREATEST(
      uw.timestamp,
      EXTRACT(EPOCH FROM u.updated_at) * 1000
    ) > $2
AND u.del_flag = false
ORDER BY timestamp ASC
`;

    const query = `SELECT
  uw.user_id AS id,
  u.wiegand_flag,
  u.admin_auth,
  uw.del_flag,
  uw.timestamp
FROM user_wiegands uw
JOIN users u ON u.user_id = uw.user_id
WHERE uw.sn = $1
  AND uw.timestamp >= $2
ORDER BY uw.timestamp ASC
`;


    const result = await pool.query(query, [sn, deviceTs]);

    // ------------------------------------
    // 3. Format Output (Safety layer)
    // ------------------------------------
    const formattedUsers = result.rows.map(user => ({
      ...user,
      timestamp: user.timestamp || "0",
      del_flag: !!user.del_flag
    }));

    // ------------------------------------
    // 4. Return Response
    // ------------------------------------
    return res.json({
      ...ERR.SUCCESS,
      data: { idDataList: formattedUsers }
    });

  } catch (error) {
    console.error("Query users error:", error);

    return res.json({
      ...ERR.DB_QUERY_ERROR,
      msg: `User query failed: ${error.message}`
    });
  }
};






exports.checkRegistration1 = async (req, res) => {
  try {
    // ----------------------------------------
    // 1️⃣ Parameter validation (sn and id required)
    // ----------------------------------------
    if (!req.body || !req.body.sn || !req.body.id) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, id"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    // ----------------------------------------
    // 2️⃣ Extract payload
    // ----------------------------------------
    const { sn, id } = req.body;

    // ----------------------------------------
    // 3️⃣ Database query (check if user exists)
    // ----------------------------------------
    const result = await pool.query(
      `SELECT id 
       FROM users 
       WHERE sn = $1 AND user_id = $2 
       LIMIT 1`,
      [sn, id]
    );

    // ----------------------------------------
    // 4️⃣ Return result
    // ----------------------------------------
    res.json({
      ...ERR.SUCCESS,
      data: {
        is_registered: result.rows.length > 0
      }
    });

  } catch (error) {
    console.error("Check registration error:", error);

    // ----------------------------------------
    // 5️⃣ Exception handling
    // ----------------------------------------
    res.json({
      ...ERR.DB_CHECK_REG_ERROR,
      data: {},
      msg: `Failed to check registration: ${error.message}`
    });
  }
};

exports.checkRegistration = async (req, res) => {
  try {
    if (!req.body || !req.body.sn || !req.body.id) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, id"
      });
    }

    const { sn, id } = req.body;

    const result = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM user_wiegands uw
        JOIN users u ON u.user_id = uw.user_id
        JOIN wiegand_groups wg ON wg.id = uw.group_uuid
        WHERE wg.sn = $1
          AND u.user_id = $2
          AND uw.del_flag = false
          AND u.del_flag = false
          AND wg.del_flag = false
      ) AS is_registered
      `,
      [sn, id]
    );

    return res.json({
      ...ERR.SUCCESS,
      data: {
        is_registered: result.rows[0].is_registered
      }
    });

  } catch (error) {
    console.error("Check registration error:", error);
    return res.json({
      ...ERR.DB_CHECK_REG_ERROR,
      data: {}
    });
  }
};



exports.queryUserImages1 = async (req, res) => {
  try {
    // 1️⃣ Validate request body
    if (!req.body || !req.body.sn || !req.body.id) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, id"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    // 2️⃣ Extract parameters
    const { sn, id: studentId } = req.body;

    // 3️⃣ Query database
    const result = await pool.query(
      `
      SELECT name, image_left, image_right
      FROM users
      WHERE sn = $1 AND user_id = $2
      LIMIT 1
      `,
      [sn, studentId]
    );

    // 4️⃣ Handle "user not found"
    if (result.rows.length === 0) {
      return res.json({
        ...ERR.DB_ID_NOT_EXIST,
        data: {},
        msg: `Student ID ${studentId} is not registered under device ${sn} (Error Code 30006, Document 3.1)`
      });
    }

    // 5️⃣ Return success
    const user = result.rows[0];
    return res.json({
      ...ERR.SUCCESS,
      data: {
        name: user.name,
        image_left: user.image_left,
        image_right: user.image_right
      }
    });

  } catch (error) {
    console.error("Query user images error:", error);
    return res.json({
      ...ERR.DB_QUERY_ERROR,
      data: {},
      msg: `Database query failed: ${error.message} (Error Code 30004, Document 3.1)`
    });
  }
};

exports.queryUserImages = async (req, res) => {
  try {
    // 1️⃣ Validate request body
    if (!req.body || !req.body.sn || !req.body.id) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, id"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    const { sn, id: studentId } = req.body;

    // 2️⃣ Query using proper device-user mapping
    const result = await pool.query(
      `
      SELECT u.name, u.image_left, u.image_right
      FROM user_wiegands uw
      JOIN users u ON u.user_id = uw.user_id
      JOIN wiegand_groups wg ON wg.id = uw.group_uuid
      WHERE wg.sn = $1
        AND u.user_id = $2
        AND uw.del_flag = false
        AND u.del_flag = false
        AND wg.del_flag = false
      LIMIT 1
      `,
      [sn, studentId]
    );

    // 3️⃣ Handle "user not found"
    if (result.rows.length === 0) {
      return res.json({
        ...ERR.DB_ID_NOT_EXIST,
        data: {},
        msg: `Student ID ${studentId} is not registered under device ${sn} (Error Code 30006, Document 3.1)`
      });
    }

    const user = result.rows[0];

    // 4️⃣ Return success
    return res.json({
      ...ERR.SUCCESS,
      data: {
        name: user.name,
        image_left: user.image_left,
        image_right: user.image_right
      }
    });

  } catch (error) {
    console.error("Query user images error:", error);
    return res.json({
      ...ERR.DB_QUERY_ERROR,
      data: {},
      msg: `Database query failed: ${error.message} (Error Code 30004, Document 3.1)`
    });
  }
};



exports.firmwareUpgrade1 = async (req, res) => {
  try {
    // -------------------------------
    // 1. Validate Request Body
    // -------------------------------
    if (!req.body || !req.body.sn || !req.body.version) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, version"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    // -------------------------------
    // 2. Extract payload
    // -------------------------------
    const { sn, version } = req.body;

    // -------------------------------
    // 3. Query latest firmware info
    // -------------------------------
    const result = await pool.query(
      `
      SELECT latest_firmware_version, firmware_url
      FROM system_info
      WHERE sn = $1
      LIMIT 1
      `,
      [sn]
    );

    // If device not found
    if (result.rows.length === 0) {
      return res.json({
        ...ERR.SUCCESS,
        data: {
          need: false,
          url: ""
        }
      });
    }

    const systemInfo = result.rows[0];

    // -------------------------------
    // 4. Compare version (semantic)
    // -------------------------------
    const toArray = (v) => v.split(".").map(n => Number(n));
    const pad = (arr) => [...arr, 0, 0].slice(0, 3);

    const currentVer = pad(toArray(version));
    const latestVer = pad(toArray(systemInfo.latest_firmware_version));

    let needUpdate =
      latestVer[0] > currentVer[0] ||
      (latestVer[0] === currentVer[0] && latestVer[1] > currentVer[1]) ||
      (latestVer[0] === currentVer[0] && latestVer[1] === currentVer[1] && latestVer[2] > currentVer[2]);

    // -------------------------------
    // 5. Return Response
    // -------------------------------
    return res.json({
      ...ERR.SUCCESS,
      data: {
        need: needUpdate,
        url: needUpdate ? systemInfo.firmware_url : ""
      }
    });

  } catch (error) {
    console.error("Firmware upgrade error:", error);

    return res.json({
      ...ERR.DB_QUERY_ERROR,
      msg: `Firmware upgrade check failed: ${error.message}`
    });
  }
};

exports.firmwareUpgrade = async (req, res) => {
  const interfaceName = "Firmware Upgrade Interface (Document 2.7)";
  const now = () => new Date().toLocaleString();

  try {

    // -------------------------------
    // 1️⃣ Validate Request
    // -------------------------------
    if (!req.body || !req.body.sn || !req.body.version) {
      console.warn(`[${now()}] [${interfaceName}] Missing sn or version`);
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, version"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(`[${now()}] [${interfaceName}] Validation failed`, errors.array());
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    const { sn, version } = req.body;

    // -------------------------------
    // 2️⃣ Query system_info
    // -------------------------------
    const result = await pool.query(
      `
      SELECT latest_firmware_version, firmware_url
      FROM system_info
      WHERE sn = $1
      LIMIT 1
      `,
      [sn]
    );

    if (result.rows.length === 0) {
      console.warn(`[${now()}] [${interfaceName}] No firmware config found for device ${sn}`);
      return res.json({
        ...ERR.SUCCESS,
        data: {
          need: false,
          url: ""
        }
      });
    }

    const { latest_firmware_version, firmware_url } = result.rows[0];

    // -------------------------------
    // 3️⃣ Safe Semantic Version Compare
    // -------------------------------
    const safeParse = (v) => {
      if (!v || typeof v !== "string") return [0, 0, 0];
      return v.split(".").map(n => Number(n) || 0);
    };

    const pad = (arr) => [...arr, 0, 0].slice(0, 3);

    const currentVer = pad(safeParse(version));
    const latestVer = pad(safeParse(latest_firmware_version));

    const needUpdate =
      latestVer[0] > currentVer[0] ||
      (latestVer[0] === currentVer[0] && latestVer[1] > currentVer[1]) ||
      (latestVer[0] === currentVer[0] &&
        latestVer[1] === currentVer[1] &&
        latestVer[2] > currentVer[2]);

    // -------------------------------
    // 4️⃣ Return Response
    // -------------------------------
    const response = {
      ...ERR.SUCCESS,
      data: {
        need: needUpdate,
        url: needUpdate ? firmware_url : ""
      }
    };

    return res.json(response);

  } catch (error) {
    console.error(`[${now()}] [${interfaceName}] Exception:`, error);

    return res.json({
      ...ERR.DB_QUERY_ERROR,
      data: {},
      msg: `Firmware upgrade check failed: ${error.message}`
    });
  }
};


exports.passList1 = async (req, res) => {
  try {
    // 1️⃣ Parameter validation (sn, name, id, type, device_date_time are required)

    if (!req.body || !req.body.sn || !req.body.name || !req.body.id || !req.body.type || !req.body.device_date_time) {
      return res.json({ ...ERR.PARAM_ERROR, errors: "Missing required fields: sn, name, id, type, device_date_time" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ ...ERR.PARAM_ERROR, errors: errors.array() });
    }

    // 2️⃣ Extract parameters
    const { sn, name, id: userId, type: palmType, device_date_time } = req.body;

    // 3️⃣ Insert record into database
    await pool.query(
      `
      INSERT INTO device_access_logs (sn, name, user_id, palm_type, device_date_time)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [sn, name, userId, palmType, device_date_time]
    );

    // 4️⃣ Return success response
    return res.json({ ...ERR.SUCCESS });

  } catch (error) {
    console.error("Insert access record error:", error);
    return res.json({ ...ERR.DB_INSERT_ERROR, msg: `Database insert failed: ${error.message}` });
  }
};

exports.passList = async (req, res) => {
  try {

    // -----------------------------
    // 1️⃣ Validate required fields
    // -----------------------------
    const { sn, name, id: userId, type: palmType, device_date_time } = req.body;

    if (!sn || !name || !userId || !palmType || !device_date_time) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Missing required fields: sn, name, id, type, device_date_time"
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: errors.array()
      });
    }

    // -----------------------------
    // 2️⃣ Validate palm type
    // -----------------------------
    if (!["left", "right"].includes(palmType)) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Invalid palm type. Must be 'left' or 'right'"
      });
    }

    // -----------------------------
    // 3️⃣ Validate datetime format
    // -----------------------------
    const parsedDate = new Date(device_date_time);
    if (isNaN(parsedDate.getTime())) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: "Invalid device_date_time format"
      });
    }

    // -----------------------------
    // 4️⃣ Optional: Check device exists
    // -----------------------------
    const deviceCheck = await pool.query(
      `SELECT 1 FROM devices WHERE sn = $1 LIMIT 1`,
      [sn]
    );

    if (deviceCheck.rowCount === 0) {
      return res.json({
        ...ERR.PARAM_ERROR,
        errors: `Device ${sn} not registered`
      });
    }

    // -----------------------------
    // 5️⃣ Insert access record
    // -----------------------------
    await pool.query(
      `
      INSERT INTO device_access_logs 
        (sn, name, user_id, palm_type, device_date_time)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [sn, name, userId, palmType, parsedDate]
    );

    // -----------------------------
    // 6️⃣ Return success
    // -----------------------------
    return res.json({ ...ERR.SUCCESS });

  } catch (error) {
    console.error("Insert access record error:", error);

    return res.json({
      ...ERR.DB_INSERT_ERROR,
      msg: `Database insert failed: ${error.message}`
    });
  }
};


exports.queryBatchImportPath = async (req, res) => {
  try {
    // 1️⃣ Parameter validation (sn is required)
    if (!req.body || !req.body.sn) {
      return res.json({ ...ERR.PARAM_ERROR, errors: "Missing required field: sn" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ ...ERR.PARAM_ERROR, errors: errors.array() });
    }

    // 2️⃣ Extract payload
    const { sn } = req.body;

    // 3️⃣ Query database for batch import URL
    const result = await pool.query(
      `SELECT batch_import_url FROM system_info WHERE sn = $1 LIMIT 1`,
      [sn]
    );

    // 4️⃣ Determine URL (fallback to default if not found)
    const importUrl = result.rows.length > 0
      ? result.rows[0].batch_import_url
      : 'https://example.com/default_batch.csv';

    // 5️⃣ Return success response
    res.json({
      ...ERR.SUCCESS,
      data: {
        url: importUrl
      }
    });

  } catch (error) {
    console.error("Error querying batch import path:", error);
    res.json({ ...ERR.DB_QUERY_ERROR, data: {} });
  }
};



// group management
exports.queryWiegandGroup = async (req, res) => {
  try {
    // -----------------------------
    // 1️⃣ Validate parameters
    // -----------------------------
    const { sn, device_timestamp } = req.body;

    if (!sn || device_timestamp === undefined) {
      return res.json({
        code: 400,
        msg: "Invalid parameters",
        data: { idDataList: [] }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn("Validation failed:", errors.array());
      return res.json({
        code: 400,
        msg: "Invalid parameters",
        data: { idDataList: [] }
      });
    }

    const deviceTs = Number(device_timestamp) || 0;

    // -----------------------------
    // 2️⃣ Query wiegand_groups
    // -----------------------------
    const result = await pool.query(
      `
      SELECT group_id, timestamp, del_flag, time_configs
      FROM wiegand_groups
      WHERE sn = $1
        AND timestamp > $2
      ORDER BY timestamp ASC
      `,
      [sn, deviceTs]
    );

    // -----------------------------
    // 3️⃣ Format result
    // -----------------------------
    const idDataList = result.rows.map(group => {
      const { group_id, timestamp, del_flag, time_configs } = group;

      const record = {
        id: group_id,
        timestamp: timestamp.toString(),
        del_flag: !!del_flag
      };

      if (!del_flag) {
        record.time_configs = time_configs;
      }

      return record;
    });

    // -----------------------------
    // 4️⃣ Return response
    // -----------------------------
    return res.json({
      code: 0,
      msg: "success",
      data: {
        idDataList
      }
    });

  } catch (error) {
    console.error("Query wiegand groups failed:", error);
    return res.json({
      code: 500,
      msg: "Database query failed",
      data: { idDataList: [] }
    });
  }
};

exports.queryUserWiegand = async (req, res) => {
  try {
    // -----------------------------
    // 1️⃣ Validate parameters
    // -----------------------------
    const { sn, device_timestamp } = req.body;
    if (!sn || device_timestamp === undefined) {
      return res.json({
        ...ERR.PARAM_ERROR,
        data: { idDataList: [] }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn("Validation failed:", errors.array());
      return res.json({
        ...ERR.PARAM_ERROR,
        data: { idDataList: [] }
      });
    }

    const deviceTs = Number(device_timestamp) || 0;
    // const deviceTs = Math.floor(Number(device_timestamp)/1000) || 0;
    // -----------------------------
    // 2️⃣ Query user_wiegands
    // -----------------------------
    const result = await pool.query(
      `
      SELECT user_id, timestamp, del_flag, group_id
      FROM user_wiegands
      WHERE sn = $1
        AND timestamp > $2
      ORDER BY timestamp ASC
      `,
      [sn, deviceTs]
    );

    // -----------------------------
    // 3️⃣ Format response
    // -----------------------------
    const formattedData = result.rows.map(item => {
      const record = {
        user_id: item.user_id,
        timestamp: item.timestamp.toString(),
        del_flag: !!item.del_flag
      };
      // Only include group_id if not deleted
      if (!item.del_flag) {
        record.group_id = item.group_id;
      }

      return record;
    });

    // -----------------------------
    // 4️⃣ Return response
    // -----------------------------
    return res.json({
      ...ERR.SUCCESS,
      data: {
        idDataList: formattedData
      }
    });

  } catch (error) {
    console.error("Query user wiegand failed:", error);
    return res.json({
      ...ERR.DB_QUERY_ERROR,
      data: { idDataList: [] }
    });
  }
};




