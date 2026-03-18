const { pool } = require("../config/database");

exports.createShift = async (req, res) => {
  try {
    const {
      shift_name,
      start_time,
      end_time,
      grace_minutes = 0,
      weekly_off_days = []
    } = req.body;

    if (!shift_name || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "shift_name, start_time and end_time are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO shifts
       (shift_name, start_time, end_time, grace_minutes, weekly_off_days)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [shift_name, start_time, end_time, grace_minutes, weekly_off_days]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Create Shift Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

exports.updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shift_name,
      start_time,
      end_time,
      grace_minutes,
      weekly_off_days,
      is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE shifts
       SET shift_name = $1,
           start_time = $2,
           end_time = $3,
           grace_minutes = $4,
           weekly_off_days = $5,
           is_active = $6,
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        shift_name,
        start_time,
        end_time,
        grace_minutes,
        weekly_off_days,
        is_active,
        id
      ]
    );

    return res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Update Shift Error:", err);
    return res.status(500).json({
      success: false
    });
  }
};

exports.getShift = async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT * FROM shifts`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shift not found"
      });
    }

    return res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("Get Shift Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

