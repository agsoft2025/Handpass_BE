module.exports = {
  SUCCESS: { code: 0, msg: 'success' },
  PARAM_ERROR: { code: 10000, msg: 'Parameter error' },
  NETWORK_ERROR: { code: 20000, msg: 'Network error' },
  DB_CONNECT_ERROR: { code: 30001, msg: 'Database connection failed' },
  DB_INSERT_ERROR: { code: 30002, msg: 'Database insertion failed' },
  DB_DELETE_ERROR: { code: 30003, msg: 'Database deletion failed' },
  DB_QUERY_ERROR: { code: 30004, msg: 'Database query failed' },
  DB_DUPLICATE_ERROR: { code: 30005, msg: 'Database duplicate insertion' },
  DB_ID_NOT_EXIST: { code: 30006, msg: 'Database ID does not exist' },
  DB_CHECK_REG_ERROR: { code: 30007, msg: 'Failed to check if ID is registered in database' },
  DB_UPDATE_ERROR: { code: 500, msg: "DB update failed" }
};