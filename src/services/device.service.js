const { pool } = require("../config/database");


// async function connectDevice(sn, ip,userId) {
//     console.log(userId)
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");
//     const exists = await client.query(
//       "SELECT sn FROM devices WHERE sn = $1",
//       [sn]
//     );

//     if (exists.rowCount === 0) {
//       // Insert new device
//       await client.query(
//         `
//         INSERT INTO devices (sn, device_ip, online_status,)
//         VALUES ($1, $2, 1)
//         `,
//         [sn, ip]
//       );
//     } else {
//       // Update existing device
//       await client.query(
//         `
//         UPDATE devices
//         SET online_status = 1,
//             device_ip = $2,
//             last_connect_time = now(),
//             updated_at = now()
//         WHERE sn = $1
//         `,
//         [sn, ip]
//       );
//     }

//     await client.query("COMMIT");

//     return { status: true, message: "success" };
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Error connecting device:", err);
//     throw err;
//   } finally {
//     client.release();
//   }
// }

async function connectDevice1(sn, ip) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const exists = await client.query(
      "SELECT sn FROM devices WHERE sn = $1",
      [sn]
    );

    if (exists.rowCount === 0) {
      await client.query(
        `
        INSERT INTO devices (sn, device_ip, online_status)
        VALUES ($1, $2, 1)
        `,
        [sn, ip]
      );
    } else {
      await client.query(
        `
        UPDATE devices
        SET online_status = 1,
            device_ip = $2,
            last_connect_time = now(),
            updated_at = now()
        WHERE sn = $1
        `,
        [sn, ip]
      );
    }

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error connecting device:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function connectDevice(sn, deviceIp) {
  const client = await pool.connect();
 let result = null
  try {
    await client.query('BEGIN');

    // Check if device already exists
    const { rows: existing } = await client.query(
      'SELECT sn FROM devices WHERE sn = $1',
      [sn]
    );

    if (existing.length === 0) {
      // Insert new device
      result = await client.query(
        `INSERT INTO devices (
          sn, 
         online_status, 
         device_ip, 
         last_connect_time, 
         created_at, 
         updated_at
        ) VALUES ($1, 1, $2, NOW(), NOW(), NOW()) RETURNING*`,
        [sn, deviceIp]
      );
    } else {
      // Update existing device
      result = await client.query(
        `UPDATE devices 
         SET online_status = 1,
             device_ip = $2,
             last_connect_time = NOW(),
             updated_at = NOW()
         WHERE sn = $1 RETURNING*`,
        [sn, deviceIp]
      );
    }

   await client.query('COMMIT');
 return { status:true, data:result.rows}
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // Let controller handle it
  } finally {
    client.release();
  }
}




async function addInmateService(data) {
  const {
    sn,
    id:inmate_id,
    name,
    image_left,
    image_right,
    wiegand_flag,
    admin_auth
  } = data;

  if (!sn || !inmate_id || !name) {
    return { status: 1, msg: "Missing required fields" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // FIND DEVICE
    const deviceRes = await client.query(
      "SELECT id FROM devices WHERE sn = $1",
      [sn]
    );

    if (deviceRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { status: 1, msg: "Device not found" };
    }

    const device_id = deviceRes.rows[0].id;

    // INSERT INMATE AS USER
    await client.query(
      `
      INSERT INTO users (
        id, name, role, image_left, image_right,
        wiegand_flag, admin_auth, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, 'inmate', $2, $3, $4, $5, now(), now()
      )
      `,
      [name, image_left, image_right, wiegand_flag || 0, admin_auth || 0]
    );

    await client.query("COMMIT");
    return { status: 0, msg: "success" };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Add inmate error:", err);
    return { status: 1, msg: "DB Error" };
  } finally {
    client.release();
  }
}
module.exports = { connectDevice, addInmateService };
