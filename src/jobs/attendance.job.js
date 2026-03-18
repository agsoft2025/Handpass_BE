const { getUsersWithoutPunchIn } = require("../services/attendance.service");
const { sendMissedPunchInEmail } = require("../services/email.service");

async function runAttendanceCheck(startTime) {
  const users = await getUsersWithoutPunchIn(startTime);

  if (users.length === 0) {
    return;
  }


  await sendMissedPunchInEmail(users);
}

module.exports = { runAttendanceCheck };
