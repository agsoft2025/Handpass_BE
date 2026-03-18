const { pool } = require('../../config/database');

async function createTablesIfNotExist() {
  try {
    await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone_number VARCHAR(20) NOT NULL DEFAULT '',
  password_hash TEXT,
  refresh_token TEXT,
  sn VARCHAR(50),
  user_id VARCHAR(100),
  master_user_id VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'inmate' CHECK (role IN ('admin', 'superadmin', 'inmate', 'staff', 'guard')),
  image_left TEXT,
  image_right TEXT,
  wiegand_flag INT DEFAULT 0,
  admin_auth INT DEFAULT 0,
  del_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(100),
  device_ip VARCHAR(50),
  online_status SMALLINT NOT NULL DEFAULT 0,
  last_connect_time TIMESTAMP DEFAULT now(),
  firmware_version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);


CREATE TABLE IF NOT EXISTS device_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sn VARCHAR(50) NOT NULL,               -- Device serial number
        name VARCHAR(100) NOT NULL,            -- User name
        user_id VARCHAR(100),                  -- Optional user ID
        palm_type VARCHAR(10) NOT NULL CHECK (palm_type IN ('left', 'right')),
        device_date_time TIMESTAMP NOT NULL,   -- Access time from device
        created_at TIMESTAMP DEFAULT now()     -- Record creation time
      );

      CREATE TABLE IF NOT EXISTS system_info (
  sn VARCHAR(50) PRIMARY KEY NOT NULL,                           -- Device serial number (unique)
  latest_firmware_version VARCHAR(20) NOT NULL DEFAULT '1.0.0', -- Latest firmware version
  firmware_url VARCHAR(255) NOT NULL DEFAULT 'https://example.com/firmware/default.tgz', -- Firmware download URL
  batch_import_url VARCHAR(255) NOT NULL DEFAULT 'https://example.com/batch/default.csv', -- Batch import file URL
  updated_at TIMESTAMP DEFAULT now()                             -- Last update time
);


CREATE TABLE IF NOT EXISTS wiegand_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- internal ID
    group_id VARCHAR(50) NOT NULL,                  -- device group ID
    sn VARCHAR(50) NOT NULL,                        -- device serial number
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000),
    del_flag BOOLEAN NOT NULL DEFAULT FALSE,        -- true = delete
    time_configs JSONB DEFAULT '[]'::jsonb,         -- time rules
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT unique_group_per_device UNIQUE (sn, group_id)
);

CREATE TABLE IF NOT EXISTS user_wiegands (
    id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sn VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    group_uuid UUID REFERENCES wiegand_groups(id) ON DELETE SET NULL,
    group_id VARCHAR(50) NOT NULL, 
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000),
    del_flag BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_user_device UNIQUE(user_id,sn)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  sn VARCHAR(50),
  group_id VARCHAR(50),
  attendance_date DATE NOT NULL,

  check_in TIMESTAMP,
  check_out TIMESTAMP,

  work_minutes INT DEFAULT 0,

  status VARCHAR(20) CHECK (
    status IN (
      'present',
      'absent',
      'late',
      'half_day',
      'week_off',
      'holiday'
    )
  ),

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE(user_id, attendance_date)
);

CREATE TABLE  IF NOT EXISTS processed_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100),
  sn VARCHAR(50),
  attendance_date DATE,
  first_in TIMESTAMP,
  last_out TIMESTAMP,
  total_logs INT,
  created_at TIMESTAMP DEFAULT now()
);

    `);

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`);

    console.log("✅ Tables checked/created successfully.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
    throw err;
  }
}


    // timestamp BIGINT NOT NULL DEFAULT FLOOR(EXTRACT(EPOCH FROM now() AT TIME ZONE 'Asia/Kolkata')),

module.exports = { createTablesIfNotExist };
