const cron = require('node-cron');
const { pool } = require('../config/database');
const { runAttendanceCheck } = require('../jobs/attendance.job');

let attendanceCron = null;

const { processAttendance } = require('../controllers/attendanceSettings.controller');

cron.schedule("* * * * *", async () => {
  await processAttendance();
});

