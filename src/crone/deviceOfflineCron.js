// file: cron/markOfflineDevices.js
const cron = require('node-cron');
const { pool } = require('../config/database');
const { runAttendanceCheck } = require("../jobs/attendance.job")

//Runs every 2 minutes – extremely accurate and survives server restarts
cron.schedule('* * * * *', async () => {
    try {
        const result = await pool.query(`
          UPDATE devices 
          SET online_status = 0, updated_at = NOW()
          WHERE online_status = 1 
            AND last_connect_time < NOW() - INTERVAL '10 seconds' RETURNING*
        `);

        if (result.rowCount > 0) {
            console.log(`Marked ${result.rowCount} device(s) offline – no heartbeat in 1 min`);
        }
    } catch (err) {
        console.error('Offline cron failed:', err);
    }
});

// exports.restartDatabase = async () => {
//     try {
//         const result = await pool.query(`SELECT * FROM devices WHERE online_status=0`)
//         console.log("<><>result", result.rows)
//     } catch (error) {
//         console.log("<><>working")
//     }
// }