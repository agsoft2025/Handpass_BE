const { Parser } = require("json2csv");
const { pool } = require("../config/database");
const moment = require("moment")
const secondsToTime = (sec) => {
  if (sec === null || sec === undefined) return null;

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  return moment({ hour: hours, minute: minutes }).format("hh:mm A");
};

const weekdayMap = [
  "Sunday", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday"
];

const formatTimeConfig = (configs) => {
  if (!configs || !Array.isArray(configs)) return [];

  return configs.map(c => {
    const isOvernight = c.end < c.start;

    return {
      day: weekdayMap[c.weekdays] || "Unknown",
      start_time: secondsToTime(c.start),
      end_time: secondsToTime(c.end),
      note: isOvernight ? "Next Day" : null
    };
  });
};

const formatDataByReport = (report_type, item) => {

  if (report_type === "user_wiegand_report") {
    return {
      user_id: item.user_id,
      user_name: item.user_name,
      email: item.email,
      phone_number: item.phone_number,
      sn: item.sn,
      group_id: item.group_id,
      day: item.day,
      start_time: item.start_time,
      end_time: item.end_time,
      note: item.note
    };
  }

  if (report_type === "group_report") {
    return {
      group_id: item.group_id,
      sn: item.sn,
      day: item.day,
      start_time: item.start_time,
      end_time: item.end_time,
      note: item.note,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  if (report_type === "device_report") {
    return {
      sn: item.sn,
      device_name: item.device_name,
      device_ip: item.device_ip,
      online_status: item.online_status,
      firmware_version: item.firmware_version,
      last_connect_time: item.last_connect_time
        ? moment(item.last_connect_time).format("DD-MM-YYYY HH:mm:ss")
        : null,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  if (report_type === "access_log_report") {
    return {
      user_id: item.user_id,
      user_name: item.user_name,
      sn: item.sn,
      device_name: item.device_name,
      palm_type: item.palm_type,
      device_time: item.device_date_time,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  if (report_type === "user_report") {
    return {
      user_id: item.user_id,
      user_name: item.user_name,
      email: item.email,
      phone_number: item.phone_number,
      sn: item.sn,
      device_name: item.device_name,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  return item;
};

exports.deviceAccessReport = async (req, res) => {
  try {
    const {
      report_type = "user_report",
      page = 1,
      limit,
      id,
      user_id,
      group_id,
      sn,
      sortField = "created_at",
      sortOrder = "desc",
      format = "json"
    } = req.body;

    let values = [];
    let whereClauses = [];
    let query = "";
    let countQuery = "";
    let sortableFields = {};

    /*
    --------------------------------
    USER REPORT
    --------------------------------
    */
    if (report_type === "user_report") {

      if (user_id) {
        values.push(user_id);
        whereClauses.push(`u.user_id = $${values.length}`);
      }

      if (id) {
        values.push(id);
        whereClauses.push(`u.id = $${values.length}`);
      }

      sortableFields = {
        user_name: "u.name",
        user_id: "u.user_id",
        created_at: "u.created_at"
      };

      query = `
        SELECT
          u.user_id,
          u.name AS user_name,
          u.email,
          u.phone_number,
          u.role,
          u.wiegand_flag,
          u.admin_auth,
          u.sn,
          d.device_name,
          TO_CHAR(u.created_at, 'YYYY-MM-DD') AS created_at
        FROM users u
        LEFT JOIN devices d ON d.sn = u.sn
      `;

      countQuery = `SELECT COUNT(*) FROM users u`;
    }

    /*
    --------------------------------
    DEVICE REPORT
    --------------------------------
    */
    else if (report_type === "device_report") {

      if (id) {
        values.push(id);
        whereClauses.push(`d.id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`d.sn = $${values.length}`);
      }

      sortableFields = {
        device_name: "d.device_name",
        sn: "d.sn",
        created_at: "d.created_at"
      };

      query = `
        SELECT
          d.sn,
          d.device_name,
          d.device_ip,
          d.online_status,
          d.firmware_version,
          d.last_connect_time,
          TO_CHAR(d.created_at, 'YYYY-MM-DD') AS created_at
        FROM devices d
      `;

      countQuery = `SELECT COUNT(*) FROM devices d`;
    }

    /*
    --------------------------------
    ACCESS LOG REPORT
    --------------------------------
    */
    else if (report_type === "access_log_report") {

      if (id) {
        values.push(id);
        whereClauses.push(`dal.id = $${values.length}`);
      }

      if (user_id) {
        values.push(user_id);
        whereClauses.push(`dal.user_id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`dal.sn = $${values.length}`);
      }

      sortableFields = {
        user_id: "dal.user_id",
        device_time: "dal.device_date_time",
        created_at: "dal.created_at"
      };

      query = `
        SELECT
          dal.id,
          dal.sn,
          d.device_name,
          dal.name AS user_name,
          dal.user_id,
          dal.palm_type,
          dal.device_date_time,
          TO_CHAR(dal.created_at, 'YYYY-MM-DD') AS created_at
        FROM device_access_logs dal
        LEFT JOIN devices d ON d.sn = dal.sn
      `;

      countQuery = `SELECT COUNT(*) FROM device_access_logs dal`;
    }

    /*
    --------------------------------
    GROUP REPORT
    --------------------------------
    */
    else if (report_type === "group_report") {

      if (sn) {
        values.push(sn);
        whereClauses.push(`wg.sn = $${values.length}`);
      }

      if (group_id) {
        values.push(group_id);
        whereClauses.push(`wg.group_id = $${values.length}`);
      }

      sortableFields = {
        group_id: "wg.group_id",
        sn: "wg.sn",
        created_at: "wg.created_at"
      };

      query = `
        SELECT
          wg.group_id,
          wg.sn,
          TO_CHAR(wg.created_at, 'YYYY-MM-DD') AS created_at,
          TO_CHAR(wg.updated_at, 'YYYY-MM-DD') AS created_at
        FROM wiegand_groups wg
      `;

      countQuery = `SELECT COUNT(*) FROM wiegand_groups wg`;
    }
    // --------------------------------
    // USER WIEGAND REPORT
    // --------------------------------
    else if (report_type === "user_wiegand_report") {

      if (user_id) {
        values.push(user_id);
        whereClauses.push(`uw.user_id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`uw.sn = $${values.length}`);
      }

      sortableFields = {
        user_id: "uw.user_id",
        group_id: "uw.group_id",
        sn: "uw.sn"
      };

      query = `
        SELECT
          uw.user_id,
          u.name AS user_name,
          uw.sn,
          uw.group_id
        FROM user_wiegands uw
        LEFT JOIN users u ON u.user_id = uw.user_id
      `;

      countQuery = `SELECT COUNT(*) FROM user_wiegands uw`;
    }

    else {
      return res.status(400).json({
        success: false,
        message: "Invalid report type"
      });
    }

    /*
    --------------------------------
    WHERE
    --------------------------------
    */
    const where = whereClauses.length ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    /*
    --------------------------------
    SORT
    --------------------------------
    */
    const orderField = sortableFields[sortField] || Object.values(sortableFields)[0];
    const orderBy = ` ORDER BY ${orderField} ${sortOrder === "asc" ? "ASC" : "DESC"}`;

    /*
    --------------------------------
    PAGINATION (OPTIONAL)
    --------------------------------
    */
    const pageNum = parseInt(page) || 1;
    const limitNum = limit === "all" || !limit ? null : parseInt(limit);
    const offset = limitNum ? (pageNum - 1) * limitNum : 0;

    let pagination = "";
    let finalValues = [...values];

    if (limitNum) {
      finalValues.push(limitNum, offset);
      pagination = ` LIMIT $${finalValues.length - 1} OFFSET $${finalValues.length}`;
    }

    const finalQuery = query + where + orderBy + pagination;

    /*
    --------------------------------
    EXECUTE (PARALLEL)
    --------------------------------
    */
    const [dataResult, countResult] = await Promise.all([
      pool.query(finalQuery, finalValues),
      limitNum ? pool.query(countQuery + where, values) : Promise.resolve({ rows: [] })
    ]);

    let data = dataResult.rows;

    /*
    --------------------------------
    CSV EXPORT
    --------------------------------
    */
    if (format === "csv") {
      const { Parser } = require("json2csv");
      const parser = new Parser({ fields: Object.keys(data[0] || {}) });
      const csv = parser.parse(data);

      res.setHeader("Content-Disposition", `attachment; filename=${report_type}.csv`);
      res.setHeader("Content-Type", "text/csv");

      return res.status(200).end(csv);
    }

    /*
    --------------------------------
    FINAL RESPONSE
    --------------------------------
    */
    return res.status(200).json({
      success: true,
      report_type,
      page: limitNum ? pageNum : null,
      limit: limitNum || "all",
      totalCount: limitNum ? parseInt(countResult.rows[0].count) : data.length,
      data
    });

  } catch (error) {
    console.error("deviceAccessReport error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

exports.fetchUsersByGroup = async (req, res) => {
  try {
    const {
      sn,
      page = 1,
      limit,
      sortField = "created_at",
      sortOrder = "desc"
    } = req.body;
    const { group_id } = req.param

    if (!group_id) {
      return res.status(400).json({
        success: false,
        message: "group_id is required"
      });
    }

    let values = [];
    let whereClauses = [];

    // 🔹 Filters
    values.push(group_id);
    whereClauses.push(`uw.group_id = $${values.length}`);

    if (sn) {
      values.push(sn);
      whereClauses.push(`uw.sn = $${values.length}`);
    }

    const where = `WHERE ${whereClauses.join(" AND ")}`;

    // 🔹 Sorting fields
    const sortableFields = {
      user_name: "u.name",
      user_id: "u.user_id",
      created_at: "u.created_at"
    };

    let baseOrderField =
      sortableFields[sortField] || Object.values(sortableFields)[0] || "u.created_at";

    // 🔥 Required for DISTINCT ON
    const orderField = `u.user_id, ${baseOrderField}`;

    const orderBy = `ORDER BY ${orderField} ${
      sortOrder === "asc" ? "ASC" : "DESC"
    }`;

    // 🔹 Pagination (robust handling)
    const pageNum = parseInt(page) || 1;

    let limitNum = null;
    if (limit && limit !== "all") {
      limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum <= 0) {
        limitNum = null;
      }
    }

    const offset = limitNum ? (pageNum - 1) * limitNum : 0;

    let pagination = "";
    let finalValues = [...values];

    if (limitNum) {
      finalValues.push(limitNum, offset);
      pagination = `LIMIT $${finalValues.length - 1} OFFSET $${finalValues.length}`;
    }

    // 🔹 Main Query
    const query = `
      SELECT DISTINCT ON (u.user_id)
        uw.group_id,
        u.user_id,
        u.name AS user_name,
        u.email,
        u.phone_number,
        u.role,
        u.wiegand_flag,
        u.admin_auth,
        u.sn,
        d.device_name,
        TO_CHAR(u.created_at, 'YYYY-MM-DD') AS created_at

      FROM user_wiegands uw
      INNER JOIN users u ON u.user_id = uw.user_id
      LEFT JOIN devices d ON d.sn = u.sn

      ${where}
      ${orderBy}
      ${pagination}
    `;

    // 🔹 Count Query (only if paginated)
    const countQuery = `
      SELECT COUNT(DISTINCT u.user_id) AS count
      FROM user_wiegands uw
      INNER JOIN users u ON u.user_id = uw.user_id
      ${where}
    `;

    // 🔹 Execute
    const [dataResult, countResult] = await Promise.all([
      pool.query(query, finalValues),
      limitNum
        ? pool.query(countQuery, values)
        : Promise.resolve({ rows: [{ count: 0 }] })
    ]);

    return res.status(200).json({
      success: true,
      group_id,
      page: limitNum ? pageNum : null,
      limit: limitNum || "all",
      totalCount: limitNum
        ? parseInt(countResult.rows[0].count)
        : dataResult.rows.length,
      data: dataResult.rows
    });

  } catch (error) {
    console.error("fetchUsersByGroup error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};