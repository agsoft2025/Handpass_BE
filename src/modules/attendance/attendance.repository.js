const { pool } = require("../../config/database");

exports.getRawLogs = async () => {
  const query = `
    SELECT user_id, sn, device_date_time
    FROM device_access_logs
    WHERE device_date_time >= CURRENT_DATE - INTERVAL '1 day'
  `;
  return (await pool.query(query)).rows;
};


exports.insertProcessedLogs = async (data) => {
  const query = `
    INSERT INTO processed_attendance_logs
    (user_id, sn, attendance_date, first_in, last_out, total_logs)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (user_id, attendance_date)
    DO UPDATE SET
      first_in = EXCLUDED.first_in,
      last_out = EXCLUDED.last_out,
      total_logs = EXCLUDED.total_logs
  `;

  for (const row of data) {
    await pool.query(query, [
      row.user_id,
      row.sn,
      row.date,
      row.first_in,
      row.last_out,
      row.total_logs
    ]);
  }
};

exports.getProcessedLogs = async () => {
  const query = `SELECT * FROM processed_attendance_logs`;
  return (await pool.query(query)).rows;
};

exports.getUserShiftConfig = async () => {
  const query = `
    SELECT uw.user_id, wg.time_configs
    FROM user_wiegands uw
    JOIN wiegand_groups wg ON wg.id = uw.group_uuid
  `;
  return (await pool.query(query)).rows;
};

exports.upsertAttendance = async (data) => {
  const query = `
    INSERT INTO attendance_records
    (user_id, sn, attendance_date, check_in, check_out, work_minutes, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id, attendance_date)
    DO UPDATE SET
      check_in = EXCLUDED.check_in,
      check_out = EXCLUDED.check_out,
      work_minutes = EXCLUDED.work_minutes,
      status = EXCLUDED.status,
      updated_at = now()
  `;

  for (const row of data) {
    await pool.query(query, [
      row.user_id,
      row.sn,
      row.date,
      row.check_in,
      row.check_out,
      row.work_minutes,
      row.status
    ]);
  }
};
