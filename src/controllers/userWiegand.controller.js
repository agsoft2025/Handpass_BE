const { pool } = require("../config/database");

exports.addUserWiegand1 = async (req, res) => {
  try {
    const { sn, user_id, group_id = '', del_flag = false } = req.body;
    const timestamp = Math.floor(Date.now() / 1000)

    const istTime = new Date(timestamp * 1000).toLocaleString(
      "en-IN",
      { timeZone: "Asia/Kolkata" }
    )

    // Basic validation
    if (!sn || !user_id || !timestamp) {
      return res.status(400).json({
        success: false,
        message: "sn, user_id and timestamp are required"
      });
    }
    const userExisting = await pool.query(`SELECT * FROM user_wiegands WHERE user_id=$1 AND group_id =$2`, [user_id, group_id])
    if (userExisting.rows.length != 0) {
      return res.status(400).json({ success: false, message: "user with same group already existing" })
    }
    const existWiegandGrp = await pool.query(`SELECT group_id, id FROM wiegand_groups WHERE group_id = $1`, [group_id])
    if (existWiegandGrp.rows.length == 0) {
      return res.status(400).json({ success: false, message: "could not able to find group" })
    }

    const query = `
      INSERT INTO user_wiegands (sn, user_id, group_id,group_uuid, timestamp, del_flag)
      VALUES ($1, $2, $3, $4, $5,$6)
      RETURNING *;
    `;

    const values = [
      sn,
      user_id,
      group_id,
      existWiegandGrp.rows[0].id,
      timestamp,
      del_flag
    ];

    let result;
    try {
      result = await pool.query(query, values);
    } catch (e) {
      // If the partial unique index exists, inserting an exact duplicate will throw.
      // Convert to a friendly 409.
      if (e && (e.code === "23505" || String(e.message || "").includes("duplicate"))) {
        return res.status(409).json({
          success: false,
          message: "Assignment already exists for this user/device/remote group/time group"
        });
      }
      throw e;
    }

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add UserWiegand Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.addUserWiegand1 = async (req, res) => {
  try {

    const { sn, user_id, group_id = '', time_group_id = '', del_flag = false } = req.body;

    if (!sn || !user_id || !group_id || !time_group_id) {
      return res.status(400).json({
        success: false,
        message: "sn, user_id, group_id and time_group_id are required"
      });
    }

    // const timestamp = Math.floor(Date.now() / 1000);
    const timestamp = Date.now();

    // check group exists
    const existWiegandGrp = await pool.query(
      `SELECT group_id, id FROM wiegand_groups WHERE group_id = $1`,
      [group_id]
    );
    if (existWiegandGrp.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Group not found"
      });
    }

    const existTimeGroup = await pool.query(
      `SELECT id, time_group_id FROM time_groups WHERE time_group_id = $1 AND del_flag = false`,
      [time_group_id]
    );
    if (existTimeGroup.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Time group not found"
      });
    }

    // Prevent exact duplicate assignment (same user + device + remote group + time group)
    const existingAssignment = await pool.query(
      `
      SELECT id
      FROM user_wiegands
      WHERE user_id = $1
        AND sn = $2
        AND group_id = $3
        AND time_group_id = $4
        AND del_flag = false
      `,
      [user_id, sn, group_id, time_group_id]
    );
    if (existingAssignment.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Assignment already exists for this user/device/remote group/time group"
      });
    }

    const query = `
      INSERT INTO user_wiegands
        (sn, user_id, group_id, group_uuid, time_group_id, time_group_uuid, timestamp, del_flag)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `;

    const values = [
      sn,
      user_id,
      group_id,
      existWiegandGrp.rows[0].id,
      time_group_id,
      existTimeGroup.rows[0].id,
      timestamp,
      del_flag
    ];

    const result = await pool.query(query, values);

    await pool.query(
      `
      INSERT INTO device_group_assignments
        (sn, remote_group_id, time_group_id, time_group_uuid, timestamp, del_flag)
      VALUES
        ($1, $2, $3, $4, $5, false)
      ON CONFLICT ON CONSTRAINT unique_device_remote_group
      DO UPDATE SET
        time_group_id = EXCLUDED.time_group_id,
        time_group_uuid = EXCLUDED.time_group_uuid,
        timestamp = EXCLUDED.timestamp,
        del_flag = false
      `,
      [sn, group_id, time_group_id, existTimeGroup.rows[0].id, timestamp]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add UserWiegand Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.addUserWiegand = async (req, res) => {
  try {
    const { sn, user_id, assignments = [] } = req.body;

    if (!sn || !user_id || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "sn, user_id and assignments[] are required"
      });
    }

    // Validate each assignment has required fields
    const invalidAssignments = assignments.filter(item => !item.group_id || !item.time_group_id);
    if (invalidAssignments.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Each assignment must have group_id and time_group_id",
        invalid_assignments: invalidAssignments
      });
    }

    // Check for duplicate assignments upfront and return error if any found
    const duplicateChecks = [];
    for (const item of assignments) {
      const { group_id, time_group_id } = item;
      
      const existingAssignment = await pool.query(
        `
        SELECT id FROM user_wiegands
        WHERE user_id = $1 AND sn = $2
        AND group_id = $3 AND time_group_id = $4
        AND del_flag = false
        `,
        [user_id, sn, group_id, time_group_id]
      );

      if (existingAssignment.rows.length > 0) {
        duplicateChecks.push({ ...item, reason: "Assignment already exists" });
      }
    }

    // If any duplicates found, return error immediately
    if (duplicateChecks.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot add assignments - some already exist",
        duplicates: duplicateChecks,
        error_code: "DUPLICATE_ASSIGNMENTS"
      });
    }

    const timestamp = Date.now();
    const insertedData = [];
    const skippedData = [];
    const errors = [];

    for (const item of assignments) {
      const { group_id, time_group_id } = item;

      try {
        // check group exists
        const existWiegandGrp = await pool.query(
          `SELECT id FROM wiegand_groups WHERE group_id = $1`,
          [group_id]
        );

        if (existWiegandGrp.rows.length === 0) {
          skippedData.push({ ...item, reason: "Group not found" });
          continue;
        }

        // check time group exists
        const existTimeGroup = await pool.query(
          `SELECT id FROM time_groups WHERE time_group_id = $1 AND del_flag = false`,
          [time_group_id]
        );

        if (existTimeGroup.rows.length === 0) {
          skippedData.push({ ...item, reason: "Time group not found" });
          continue;
        }

        const result = await pool.query(
          `
          INSERT INTO user_wiegands
          (sn, user_id, group_id, group_uuid, time_group_id, time_group_uuid, timestamp, del_flag)
          VALUES ($1,$2,$3,$4,$5,$6,$7,false)
          RETURNING *
          `,
          [
            sn,
            user_id,
            group_id,
            existWiegandGrp.rows[0].id,
            time_group_id,
            existTimeGroup.rows[0].id,
            timestamp
          ]
        );

        insertedData.push(result.rows[0]);

        // upsert device mapping
        await pool.query(
          `
          INSERT INTO device_group_assignments
          (sn, remote_group_id, time_group_id, time_group_uuid, timestamp, del_flag)
          VALUES ($1, $2, $3, $4, $5, false)
          ON CONFLICT ON CONSTRAINT unique_device_remote_group
          DO UPDATE SET
            time_group_id = EXCLUDED.time_group_id,
            time_group_uuid = EXCLUDED.time_group_uuid,
            timestamp = EXCLUDED.timestamp,
            del_flag = false
          `,
          [sn, group_id, time_group_id, existTimeGroup.rows[0].id, timestamp]
        );

      } catch (error) {
        errors.push({ ...item, error: error.message });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully processed ${assignments.length} assignments`,
      summary: {
        total_assignments: assignments.length,
        inserted: insertedData.length,
        skipped: skippedData.length,
        errors: errors.length
      },
      data: insertedData,
      skipped: skippedData,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getUserWiegand = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      del_flag,
      sort_by = "timestamp",
      sort_order = "DESC",
      group_by_user = false  // New parameter to control grouping
    } = req.query;

    // ---- Pagination ----
    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    // ---- Sorting ----
    const validSortColumns = ["user_id", "sn", "group_id", "time_group_id", "timestamp"];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "timestamp";

    const sortDirection =
      sort_order && sort_order.toUpperCase() === "ASC"
        ? "ASC"
        : "DESC";

    // ---- Dynamic WHERE ----
    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    // del_flag filter (convert string to boolean properly)
    if (del_flag !== undefined) {
      const parsedFlag =
        del_flag === "true" || del_flag === true
          ? true
          : del_flag === "false" || del_flag === false
            ? false
            : null;

      if (parsedFlag !== null) {
        whereClauses.push(`uw.del_flag = $${paramIndex}`);
        values.push(parsedFlag);
        paramIndex++;
      }
    } else {
      // By default, only show non-deleted records
      whereClauses.push(`uw.del_flag = $${paramIndex}`);
      values.push(false);
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereClauses.push(`(
        CAST(uw.user_id AS TEXT) ILIKE $${paramIndex}
        OR uw.sn ILIKE $${paramIndex}
        OR uw.group_id ILIKE $${paramIndex}
        OR uw.time_group_id ILIKE $${paramIndex}
        OR d.device_name ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // ---- Data Query ----
    const dataQuery = `
      SELECT 
        uw.*,
        d.device_name
      FROM user_wiegands uw
      LEFT JOIN devices d 
        ON uw.sn = d.sn
      ${whereSQL}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1};
    `;

    values.push(limit);
    values.push(offset);

    // ---- Count Query ----
    const countQuery = `
      SELECT COUNT(*) 
      FROM user_wiegands uw
      LEFT JOIN devices d 
        ON uw.sn = d.sn
      ${whereSQL};
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, values.slice(0, paramIndex - 1))
    ]);

    const totalRecords = parseInt(countResult.rows[0].count);

    // ---- Group by user if requested ----
    let responseData;
    const shouldGroup = group_by_user === "true" || group_by_user === true;

    if (shouldGroup) {
      // Group assignments by user_id
      const groupedData = {};
      
      dataResult.rows.forEach(row => {
        const userId = row.user_id;
        
        if (!groupedData[userId]) {
          groupedData[userId] = {
            user_id: row.user_id,
            user_uuid: userId,
            assignments: [],
            total_assignments: 0
          };
        }
        
        // Add assignment to user's assignments array
        groupedData[userId].assignments.push({
          id: row.id,
          sn: row.sn,
          group_id: row.group_id,
          group_uuid: row.group_uuid,
          time_group_id: row.time_group_id,
          time_group_uuid: row.time_group_uuid,
          timestamp: row.timestamp,
          del_flag: row.del_flag,
          device_name: row.device_name
        });
        
        groupedData[userId].total_assignments = groupedData[userId].assignments.length;
      });

      // Convert to array format
      responseData = Object.values(groupedData);
    } else {
      // Original flat format
      responseData = dataResult.rows;
    }

    return res.status(200).json({
      success: true,
      total_records: totalRecords,
      current_page: page,
      total_pages: Math.ceil(totalRecords / limit),
      grouped_by_user: shouldGroup,
      data: responseData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.softDeleteUserWiegand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    // Check if exists and not already deleted
    const checkQuery = `
      SELECT id 
      FROM user_wiegands
      WHERE id = $1 AND del_flag = false
    `;

    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    // Soft delete
    const updateQuery = `
      UPDATE user_wiegands
      SET del_flag = true
      WHERE id = $1
      RETURNING *;
    `;

    const updateResult = await pool.query(updateQuery, [id]);

    const deleted = updateResult.rows[0];
    if (deleted?.sn && deleted?.group_id) {
      const remaining = await pool.query(
        `SELECT COUNT(*) FROM user_wiegands WHERE sn = $1 AND group_id = $2 AND del_flag = false`,
        [deleted.sn, deleted.group_id]
      );
      const count = Number(remaining.rows?.[0]?.count ?? 0);
      if (count === 0) {
        await pool.query(
          `
          UPDATE device_group_assignments
          SET del_flag = true,
              timestamp = $1,
              updated_at = now()
          WHERE sn = $2 AND remote_group_id = $3
          `,
          [Date.now(), deleted.sn, deleted.group_id]
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "User Wiegand soft deleted successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error("软删除用户韦根关联失败：", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateUserWiegand = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { sn, user_id, group_id, time_group_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    // const timestamp = Math.floor(Date.now() / 1000);
    const timestamp = Date.now();

    await client.query("BEGIN");

    // -----------------------------------
    // 1️⃣ Check existing record
    // -----------------------------------
    const existing = await client.query(
      `SELECT * 
       FROM user_wiegands
       WHERE id = $1 AND del_flag = false`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    const current = existing.rows[0];

    let newSn = sn || current.sn;
    let newUserId = user_id || current.user_id;
    let newGroupId = group_id || current.group_id;
    let newTimeGroupId = time_group_id || current.time_group_id;
    let group_uuid = current.group_uuid;
    let time_group_uuid = current.time_group_uuid;

    // -----------------------------------
    // 2️⃣ Validate group if changed
    // -----------------------------------
    if (group_id) {
      const groupResult = await client.query(
        `SELECT id 
         FROM wiegand_groups
         WHERE group_id = $1`,
        [group_id]
      );

      if (groupResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Group not found"
        });
      }

      group_uuid = groupResult.rows[0].id;
    }

    // -----------------------------------
    // 3️⃣ Prevent exact duplicate assignment
    //    (user_id + sn + group_id + time_group_id) among active rows
    // -----------------------------------
    const duplicateCheck = await client.query(
      `
      SELECT id
      FROM user_wiegands
      WHERE user_id = $1
        AND sn = $2
        AND group_id = $3
        AND time_group_id = $4
        AND del_flag = false
        AND id != $5
      `,
      [newUserId, newSn, newGroupId, newTimeGroupId, id]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Assignment already exists for this user/device/remote group/time group"
      });
    }

    // -----------------------------------
    // 4️⃣ Update record
    // -----------------------------------
    const updateResult = await client.query(
      `
      UPDATE user_wiegands
      SET
        sn = $1,
        user_id = $2,
        group_id = $3,
        group_uuid = $4,
        time_group_id = $5,
        time_group_uuid = $6,
        timestamp = $7
      WHERE id = $8
      RETURNING *;
      `,
      [
        newSn,
        newUserId,
        newGroupId,
        group_uuid,
        newTimeGroupId,
        time_group_uuid,
        timestamp,
        id
      ]
    );

    await client.query(
      `
      INSERT INTO device_group_assignments
        (sn, remote_group_id, time_group_id, time_group_uuid, timestamp, del_flag)
      VALUES
        ($1, $2, $3, $4, $5, false)
      ON CONFLICT ON CONSTRAINT unique_device_remote_group
      DO UPDATE SET
        time_group_id = EXCLUDED.time_group_id,
        time_group_uuid = EXCLUDED.time_group_uuid,
        timestamp = EXCLUDED.timestamp,
        del_flag = false
      `,
      [newSn, newGroupId, newTimeGroupId, time_group_uuid, timestamp]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "User Wiegand updated successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update UserWiegand Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};

// Delete single assignment for a user
exports.deleteUserAssignment = async (req, res) => {
  console.log("<><>working");
  
  const client = await pool.connect();

  try {
    const { user_id, id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id is required"
      });
    }

    await client.query("BEGIN");

    // If id is provided, delete specific record
    if (id) {
      // Check if assignment exists and belongs to the user
      const checkQuery = `
        SELECT id, sn, group_id, time_group_id
        FROM user_wiegands
        WHERE id = $1 AND user_id = $2 AND del_flag = false
      `;

      const checkResult = await client.query(checkQuery, [id, user_id]);
console.log("<><>checkResult",checkResult);

      if (checkResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Assignment not found, already deleted, or does not belong to this user"
        });
      }

      const assignment = checkResult.rows[0];

      // Soft delete the specific assignment
      const updateQuery = `
        UPDATE user_wiegands
        SET del_flag = true, timestamp = $1
        WHERE id = $2 AND user_id = $3 AND del_flag = false
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [Date.now(), id, user_id]);

      // Check if there are remaining assignments for this device-group combination
      const remaining = await client.query(
        `SELECT COUNT(*) FROM user_wiegands WHERE sn = $1 AND group_id = $2 AND del_flag = false`,
        [assignment.sn, assignment.group_id]
      );
      const count = Number(remaining.rows?.[0]?.count ?? 0);
      
      if (count === 0) {
        await client.query(
          `
          UPDATE device_group_assignments
          SET del_flag = true,
              timestamp = $1,
              updated_at = now()
          WHERE sn = $2 AND remote_group_id = $3
          `,
          [Date.now(), assignment.sn, assignment.group_id]
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Assignment deleted successfully",
        data: updateResult.rows[0]
      });

    } else {
      // Delete all assignments for the user
      const getAssignmentsQuery = `
        SELECT id, sn, group_id, time_group_id
        FROM user_wiegands
        WHERE user_id = $1 AND del_flag = false
      `;

      const assignmentsResult = await client.query(getAssignmentsQuery, [user_id]);

      if (assignmentsResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "No assignments found for this user"
        });
      }

      // Soft delete all assignments for the user
      const deleteQuery = `
        UPDATE user_wiegands
        SET del_flag = true, timestamp = $1
        WHERE user_id = $2 AND del_flag = false
        RETURNING *
      `;

      const deleteResult = await client.query(deleteQuery, [Date.now(), user_id]);

      // Check and update device_group_assignments for each affected group
      const affectedGroups = [...new Set(assignmentsResult.rows.map(row => row.group_id))];
      
      for (const group_id of affectedGroups) {
        // Get all devices for this user-group combination
        const deviceGroups = assignmentsResult.rows
          .filter(row => row.group_id === group_id)
          .map(row => row.sn);

        for (const sn of deviceGroups) {
          const remaining = await client.query(
            `SELECT COUNT(*) FROM user_wiegands WHERE sn = $1 AND group_id = $2 AND del_flag = false`,
            [sn, group_id]
          );
          const count = Number(remaining.rows?.[0]?.count ?? 0);
          
          if (count === 0) {
            await client.query(
              `
              UPDATE device_group_assignments
              SET del_flag = true,
                  timestamp = $1,
                  updated_at = now()
              WHERE sn = $2 AND remote_group_id = $3
              `,
              [Date.now(), sn, group_id]
            );
          }
        }
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${deleteResult.rows.length} assignments for user ${user_id}`,
        deleted_count: deleteResult.rows.length,
        data: deleteResult.rows
      });
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Assignment Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    client.release();
  }
};

// Delete all assignments for a user (completely)
exports.deleteAllUserAssignments = async (req, res) => {
  const client = await pool.connect();

  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id required"
      });
    }

    await client.query("BEGIN");

    // Get all assignments for this user and device before deletion
    const getAssignmentsQuery = `
      SELECT id, group_id, time_group_id
      FROM user_wiegands
      WHERE user_id = $1 AND del_flag = false
    `;

    const assignmentsResult = await client.query(getAssignmentsQuery, [user_id]);

    if (assignmentsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "No assignments found for this user and device"
      });
    }

    // Soft delete all assignments
    const deleteQuery = `
      UPDATE user_wiegands
      SET del_flag = true, timestamp = $1
      WHERE user_id = $2  AND del_flag = false
      RETURNING *
    `;

    const deleteResult = await client.query(deleteQuery, [Date.now(), user_id]);

    // Check and update device_group_assignments for each affected group
    const affectedGroups = [...new Set(assignmentsResult.rows.map(row => row.group_id))];
    
    for (const group_id of affectedGroups) {
      const remaining = await client.query(
        `SELECT COUNT(*) FROM user_wiegands WHERE group_id = $1 AND del_flag = false`,
        [ group_id]
      );
      const count = Number(remaining.rows?.[0]?.count ?? 0);
      
      if (count === 0) {
        await client.query(
          `
          UPDATE device_group_assignments
          SET del_flag = true,
              timestamp = $1,
              updated_at = now()
          WHERE remote_group_id = $2
          `,
          [Date.now(), group_id]
        );
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.rows.length} assignments for user ${user_id}`,
      deleted_count: deleteResult.rows.length,
      data: deleteResult.rows
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete All User Assignments Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    client.release();
  }
};





