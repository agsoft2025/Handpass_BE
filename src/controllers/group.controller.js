const { pool } = require("../config/database");

exports.createWiegandGroup = async (req, res) => {
  const { sn, time_configs } = req.body;

  if (!sn || !Array.isArray(time_configs)) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const config of time_configs) {
      const { start, end, weekdays } = config;

      await client.query(`
        INSERT INTO wiegand_groups
        (sn, start_time, end_time, weekdays)
        VALUES ($1, $2, $3, $4, $5)
      `, [ sn, start, end, weekdays]);
    }

    await client.query("COMMIT");

    res.json({ code: 0, msg: "Group created successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};


exports.updateWiegandGroup = async (req, res) => {
  const { sn, group_id, time_configs } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // soft delete old rules
    await client.query(`
      UPDATE wiegand_groups
      SET del_flag = true,
          updated_at = now()
      WHERE id = $1 AND sn = $2
    `, [group_id, sn]);

    // insert new ones
    for (const config of time_configs) {
      const { start, end, weekdays } = config;

      await client.query(`
        INSERT INTO wiegand_groups
        (id, sn, start_time, end_time, weekdays)
        VALUES ($1, $2, $3, $4, $5)
      `, [group_id, sn, start, end, weekdays]);
    }

    await client.query("COMMIT");

    res.json({ code: 0, msg: "Group updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

exports.deleteWiegandGroup = async (req, res) => {
  const { sn, group_id } = req.body;

  await pool.query(`
    UPDATE wiegand_groups
    SET del_flag = true,
        updated_at = now()
    WHERE id = $1 AND sn = $2
  `, [group_id, sn]);

  res.json({ code: 0, msg: "Group deleted" });
};


// Assign User To Group
exports.assignUserWiegand = async (req, res) => {
  const { sn, user_id, group_id } = req.body;

  await pool.query(`
    INSERT INTO user_wiegand_map (sn, user_id, group_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (sn, user_id)
    DO UPDATE SET
      group_id = EXCLUDED.group_id,
      del_flag = false,
      updated_at = now()
  `, [sn, user_id, group_id]);

  res.json({ code: 0, msg: "User assigned to group" });
};

// Remove User From Group

exports.removeUserWiegand = async (req, res) => {
  const { sn, user_id } = req.body;

  await pool.query(`
    UPDATE user_wiegand_map
    SET del_flag = true,
        updated_at = now()
    WHERE sn = $1 AND user_id = $2
  `, [sn, user_id]);

  res.json({ code: 0, msg: "User removed from group" });
};

