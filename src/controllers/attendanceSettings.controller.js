const moment = require("moment");
const { pool } = require('../config/database');

exports.processAttendance = async () => {
  try {

    const query = `INSERT INTO attendance_records
(user_id, sn, attendance_date, check_in, check_out, work_minutes, status)

SELECT
  user_id,
  MIN(sn) as sn, -- pick any one device
  DATE(device_date_time),

  MIN(device_date_time),
  MAX(device_date_time),

  EXTRACT(EPOCH FROM (MAX(device_date_time) - MIN(device_date_time)))/60,

  CASE
    WHEN MIN(device_date_time)::time > '09:15' THEN 'late'
    ELSE 'present'
  END

FROM device_access_logs
GROUP BY user_id, DATE(device_date_time)

ON CONFLICT (user_id, attendance_date)
DO UPDATE SET
  check_in = EXCLUDED.check_in,
  check_out = EXCLUDED.check_out,
  work_minutes = EXCLUDED.work_minutes,
  status = EXCLUDED.status,
  updated_at = now()`;

    await pool.query(query);

  } catch (error) {
    console.error("Attendance processing failed", error);
  }
};

exports.fetchAttendance = async (req, res) => {
  try {
    const { user_id, month, year } = req.body;

    // 🟢 CASE 1: Single user calendar
    if (user_id) {
      const query = `
        WITH dates AS (
          SELECT generate_series(
            DATE_TRUNC('month', TO_DATE($2 || '-' || $3, 'YYYY-MM')),
            DATE_TRUNC('month', TO_DATE($2 || '-' || $3, 'YYYY-MM')) + INTERVAL '1 month - 1 day',
            INTERVAL '1 day'
          )::date AS attendance_date
        )

        SELECT
          d.attendance_date,
          ar.check_in,
          ar.check_out,
          ar.work_minutes,

          CASE
            WHEN d.attendance_date > CURRENT_DATE THEN 'upcoming'
            WHEN TO_CHAR(d.attendance_date, 'DY') = 'SUN' THEN 'week_off'
            WHEN ar.status IS NULL THEN 'absent'
            ELSE ar.status
          END AS status

        FROM dates d
        LEFT JOIN attendance_records ar
          ON ar.attendance_date = d.attendance_date
          AND ar.user_id = $1

        ORDER BY d.attendance_date;
      `;

      const result = await pool.query(query, [user_id, year, month]);

      return res.json({
        success: true,
        type: "single_user",
        data: result.rows
      });
    }

    // 🔵 CASE 2: Monthly summary (all users)
    const query = `
      WITH dates AS (
        SELECT generate_series(
          DATE_TRUNC('month', TO_DATE($1 || '-' || $2, 'YYYY-MM')),
          DATE_TRUNC('month', TO_DATE($1 || '-' || $2, 'YYYY-MM')) + INTERVAL '1 month - 1 day',
          INTERVAL '1 day'
        )::date AS attendance_date
      ),

      users_list AS (
        SELECT user_id FROM users WHERE del_flag = false
      ),

      user_dates AS (
        SELECT u.user_id, d.attendance_date
        FROM users_list u
        CROSS JOIN dates d
      )

      SELECT
        ud.attendance_date,

        COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present,
        COUNT(CASE WHEN ar.status = 'late' THEN 1 END) AS late,
        COUNT(CASE WHEN ar.status = 'half_day' THEN 1 END) AS half_day,

        COUNT(CASE 
          WHEN ar.user_id IS NULL 
          AND ud.attendance_date <= CURRENT_DATE
          AND TO_CHAR(ud.attendance_date, 'DY') != 'SUN'
          THEN 1 
        END) AS absent,

        COUNT(CASE 
          WHEN TO_CHAR(ud.attendance_date, 'DY') = 'SUN'
          THEN 1 
        END) AS week_off

      FROM user_dates ud
      LEFT JOIN attendance_records ar
        ON ar.user_id = ud.user_id
        AND ar.attendance_date = ud.attendance_date

      GROUP BY ud.attendance_date
      ORDER BY ud.attendance_date;
    `;

    const result = await pool.query(query, [year, month]);

    return res.json({
      success: true,
      type: "monthly_summary",
      data: result.rows
    });

  } catch (error) {
    console.error("Fetch attendance failed", error);
    res.status(500).json({ success: false });
  }
};
