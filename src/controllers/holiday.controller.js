const { pool } = require("../config/database");


/**
 * ADD holiday
 */
exports.addHoliday = async (req, res) => {
    try {
        const { holiday_date, reason } = req.body;

        if (!holiday_date) {
            return res.status(400).json({ msg: 'holiday_date is required' });
        }

        const result = await pool.query(
            `INSERT INTO attendance_holidays (holiday_date, reason)
       VALUES ($1, $2)
       RETURNING *`,
            [holiday_date, reason || null]
        );

        res.status(201).json({
            msg: 'Holiday added successfully',
            data: result.rows[0]
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ msg: 'Holiday already exists for this date' });
        }

        console.error('addHoliday error:', err);
        res.status(500).json({ msg: 'Internal server error' });
    }
};

/**
 * GET all holidays
 */
exports.getAllHolidays = async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM attendance_holidays ORDER BY holiday_date ASC`
        );

        res.json({ data: result.rows });
    } catch (err) {
        console.error('getAllHolidays error:', err);
        res.status(500).json({ msg: 'Internal server error' });
    }
};

/**
 * GET single holiday
 */
exports.getHolidayById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM attendance_holidays WHERE id = $1`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Holiday not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('getHolidayById error:', err);
        res.status(500).json({ msg: 'Internal server error' });
    }
};

/**
 * UPDATE holiday
 */
exports.updateHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const { holiday_date, reason } = req.body;

        const result = await pool.query(
            `UPDATE attendance_holidays
       SET holiday_date = COALESCE($1, holiday_date),
           reason = COALESCE($2, reason)
       WHERE id = $3
       RETURNING *`,
            [holiday_date, reason, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Holiday not found' });
        }

        res.json({
            msg: 'Holiday updated successfully',
            data: result.rows[0]
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ msg: 'Holiday already exists for this date' });
        }

        console.error('updateHoliday error:', err);
        res.status(500).json({ msg: 'Internal server error' });
    }
};

/**
 * DELETE holiday
 */
exports.deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM attendance_holidays WHERE id = $1`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Holiday not found' });
        }

        res.json({ msg: 'Holiday deleted successfully' });
    } catch (err) {
        console.error('deleteHoliday error:', err);
        res.status(500).json({ msg: 'Internal server error' });
    }
};

/**
 * ADD BULK holiday
 */
exports.addBulkHolidays = async (req, res) => {
  const client = await pool.connect();

  try {
    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({
        msg: 'holidays must be a non-empty array'
      });
    }

    await client.query('BEGIN');

    const inserted = [];
    const alreadyExists = [];

    for (const h of holidays) {
      if (!h.holiday_date) continue;

      // check if already exists
      const check = await client.query(
        `SELECT id FROM attendance_holidays WHERE holiday_date = $1`,
        [h.holiday_date]
      );

      if (check.rowCount > 0) {
        alreadyExists.push(h.holiday_date);
        continue;
      }

      // insert
      const result = await client.query(
        `INSERT INTO attendance_holidays (holiday_date, reason)
         VALUES ($1, $2)
         RETURNING *`,
        [h.holiday_date, h.reason || null]
      );

      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      msg: 'Bulk holiday process completed',
      inserted_count: inserted.length,
      already_exists_count: alreadyExists.length,
      inserted,
      already_exists: alreadyExists
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('addBulkHolidays error:', err);
    res.status(500).json({ msg: 'Internal server error' });
  } finally {
    client.release();
  }
};

