exports.aggregateLogs = (logs) => {
  const map = {};

  logs.forEach(log => {
    const key = `${log.user_id}_${log.sn}_${new Date(log.device_date_time).toDateString()}`;

    if (!map[key]) {
      map[key] = {
        user_id: log.user_id,
        sn: log.sn,
        date: new Date(log.device_date_time),
        first_in: log.device_date_time,
        last_out: log.device_date_time,
        total_logs: 1
      };
    } else {
      map[key].total_logs += 1;

      if (log.device_date_time < map[key].first_in) {
        map[key].first_in = log.device_date_time;
      }

      if (log.device_date_time > map[key].last_out) {
        map[key].last_out = log.device_date_time;
      }
    }
  });

  return Object.values(map);
};