const { pool } = require('../config/database');

// const repo = require('./attendance.repository');
const repo = require('../modules/attendance/attendance.repository');
const processor = require('../modules/attendance/attendance.processor');
const rules = require('../modules/attendance/attendance.rules');

exports.processAttendance = async () => {
  console.log("🚀 Attendance job started");

  // 1. Get raw logs
  const logs = await repo.getRawLogs();

  // 2. Aggregate
  const processed = processor.aggregateLogs(logs);

  // 3. Save processed logs
  await repo.insertProcessedLogs(processed);

  // 4. Get configs
  const configs = await repo.getUserShiftConfig();

  const configMap = {};
  configs.forEach(c => {
    configMap[c.user_id] = c.time_configs[0]; // assuming 1 config
  });

  // 5. Apply rules
  const attendanceData = processed.map(log => {
    const config = configMap[log.user_id];

    const { status, workMinutes } = rules.calculateStatus(log, config);

    return {
      user_id: log.user_id,
      sn: log.sn,
      date: log.date,
      check_in: log.first_in,
      check_out: log.last_out,
      work_minutes: workMinutes,
      status
    };
  });

  // 6. Save attendance
  await repo.upsertAttendance(attendanceData);

  console.log("✅ Attendance job completed");
};
