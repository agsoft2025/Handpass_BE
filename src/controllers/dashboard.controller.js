const { pool } = require("../config/database");

exports.fetchDashboard = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const [
      totalUsersRes,
      activeDevicesRes,
      todayGrantedRes,
      logsRes,
      logsCountRes
    ] = await Promise.all([

      // ✅ FIXED: cast UUID → text
      pool.query(`
        SELECT COUNT(DISTINCT COALESCE(master_user_id, id::text)) AS count
        FROM users
      `),

      pool.query(`
        SELECT COUNT(*) AS count
        FROM devices
        WHERE online_status = 1
      `),

      pool.query(`
        SELECT COUNT(*) AS count
        FROM device_access_logs
        WHERE DATE(device_date_time) = CURRENT_DATE
      `),

      pool.query(`
        SELECT
          id,
          sn,
          name,
          user_id,
          palm_type,
          device_date_time,
          created_at
        FROM device_access_logs
        ORDER BY device_date_time DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),

      pool.query(`
        SELECT COUNT(*) AS count
        FROM device_access_logs
      `)
    ]);

    const totalLogs = Number(logsCountRes.rows[0].count);

    return res.status(200).json({
      status: true,
      data: {
        totalUsers: Number(totalUsersRes.rows[0].count),
        activeDevices: Number(activeDevicesRes.rows[0].count),
        todayGranted: Number(todayGrantedRes.rows[0].count),
        todayDenied: 0, // you don't store denied logs yet
        recentLogs: logsRes.rows
      },
      pagination: {
        page,
        limit,
        totalLogs,
        totalPages: Math.ceil(totalLogs / limit),
        hasNext: page * limit < totalLogs,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};


