const { pool } = require('../config/database');

async function clearAllTables() {
  try {
    // Disable foreign key constraints temporarily
    await pool.query('SET session_replication_role = replica;');

    // Truncate tables in order (child tables first)
    const data = await pool.query(`
  TRUNCATE TABLE devices,users,pass_records,firmware_updates,batch_import_files
  RESTART IDENTITY CASCADE;
`);
    //  users,
    // Re-enable foreign key constraints
    await pool.query('SET session_replication_role = DEFAULT;');
    return { status: true, message: "All tables cleared successfully" }
  } catch (err) {
    console.error('❌ Failed to clear tables:', err);
    return { status: false, message: `${err.message}` }
  }
}

async function dropAllTables() {
  try {
    // Disable foreign key constraints temporarily
    await pool.query('SET session_replication_role = replica;');

    // Drop tables in order (child tables first)
    const tables = [
      'devices','users','pass_records','firmware_updates','batch_import_files'
    ];
    //  'users',
    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }

    // Re-enable foreign key constraints
    await pool.query('SET session_replication_role = DEFAULT;');

    return { status: true, message: "All tables dropped successfully" };
  } catch (err) {
    console.error('❌ Failed to drop tables:', err);
    return { status: false, message: err.message };
  }
}
module.exports = { clearAllTables, dropAllTables };
