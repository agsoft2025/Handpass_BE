const moment = require('moment');

exports.calculateStatus = (log, config) => {
  const shiftStart = moment(config.shift_start, "HH:mm");
  const grace = config.grace_minutes;
  const halfDayMinutes = config.half_day_minutes;

  const checkIn = moment(log.first_in);
  const checkOut = moment(log.last_out);

  const workMinutes = checkOut.diff(checkIn, 'minutes');

  if (!log.total_logs) return { status: 'absent', workMinutes: 0 };

  if (checkIn.isAfter(shiftStart.clone().add(grace, 'minutes'))) {
    return { status: 'late', workMinutes };
  }

  if (workMinutes < halfDayMinutes) {
    return { status: 'half_day', workMinutes };
  }

  return { status: 'present', workMinutes };
};