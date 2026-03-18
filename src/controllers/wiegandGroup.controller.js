const { pool } = require("../config/database");


exports.createWiegandGroup = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            group_id,
            sn,
            time_configs = [],
            del_flag = 0
        } = req.body;
        // const timestamp = Math.floor(Date.now() / 1000);
        const timestamp = Date.now();
        if (!group_id || !sn || !timestamp) {
            return res.status(400).json({
                code: 400,
                msg: "group_id, sn, timestamp",
                data: null
            });
        }

        if (isNaN(Number(timestamp))) {
            return res.status(400).json({
                code: 400,
                msg: "timestamp ",
                data: null
            });
        }

        if (!Array.isArray(time_configs)) {
            return res.status(400).json({
                code: 400,
                msg: "time_configs",
                data: null
            });
        }

        const parsedTimestamp = Number(timestamp);
        const parsedDelFlag = Boolean(del_flag);

        await client.query("BEGIN");

        // -----------------------------
        // 2️⃣ Insert
        // -----------------------------
        const query = `
      INSERT INTO wiegand_groups 
        (group_id, sn, timestamp, del_flag, time_configs)
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING id, group_id, sn, timestamp, del_flag, time_configs;
    `;

        const values = [
            group_id,
            sn,
            parsedTimestamp,
            parsedDelFlag,
            JSON.stringify(time_configs)
        ];

        const result = await client.query(query, values);

        await client.query("COMMIT");

        const row = result.rows[0];

        return res.status(200).json({
            code: 200,
            msg: "success",
            data: {
                id: row.id,
                group_id: row.group_id,
                sn: row.sn,
                timestamp: String(row.timestamp),
                del_flag: row.del_flag,
                time_configs: row.time_configs
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
            return res.status(409).json({
                code: 409,
                msg: error.message,
                data: null
            });
        }

        return res.status(500).json({
            code: 500,
            msg: error.message,
            data: null
        });

    } finally {
        client.release();
    }
};

exports.getWiegandGroups = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            sort_by = "wg.group_id",
            sort_order = "ASC",
            del_flag = 0,
            sn
        } = req.query;

        // ----------------------------
        // 1️⃣ Validate del_flag
        // ----------------------------
        const parsedDelFlag = Number(del_flag);
        if (![0, 1].includes(parsedDelFlag)) {
            return res.status(400).json({
                code: 400,
                msg: "del_flag",
                data: null
            });
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const offset = (pageNum - 1) * limitNum;

        // ----------------------------
        // 2️⃣ Sorting validation
        // ----------------------------
        const validSortFields = [
            "wg.group_id",
            "wg.timestamp",
            "wg.created_at",
            "wg.updated_at"
        ];

        const sortField = validSortFields.includes(sort_by)
            ? sort_by
            : "wg.group_id";

        const sortDirection =
            sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

        // ----------------------------
        // 3️⃣ WHERE Conditions
        // ----------------------------
        let whereConditions = ["wg.del_flag = $1"];
        let values = [parsedDelFlag === 1];
        let paramIndex = 2;

        if (sn) {
            whereConditions.push(`wg.sn = $${paramIndex++}`);
            values.push(sn);
        }

        if (search) {
            whereConditions.push(
                `(wg.group_id ILIKE $${paramIndex} OR wg.sn ILIKE $${paramIndex})`
            );
            values.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length
            ? `WHERE ${whereConditions.join(" AND ")}`
            : "";

        // ----------------------------
        // 4️⃣ Main Query (JOIN)
        // ----------------------------
        const query = `
      SELECT 
        wg.id,
        wg.group_id,
        wg.sn,
        wg.timestamp,
        wg.del_flag,
        wg.time_configs,
        d.device_name,
        d.device_ip,
        d.online_status
      FROM wiegand_groups wg
      LEFT JOIN devices d ON wg.sn = d.sn
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

        values.push(limitNum, offset);

        const result = await pool.query(query, values);

        // ----------------------------
        // 5️⃣ Count Query (for pagination)
        // ----------------------------
        const countQuery = `
      SELECT COUNT(*) 
      FROM wiegand_groups wg
      ${whereClause}
    `;

        const countResult = await pool.query(
            countQuery,
            values.slice(0, values.length - 2)
        );

        const total = Number(countResult.rows[0].count);

        return res.status(200).json({
            code: 200,
            msg: "operation successful",
            data: result.rows.map(row => ({
                id: row.id,
                group_id: row.group_id,
                sn: row.sn,
                user_id: row.user_id,
                timestamp: String(row.timestamp),
                del_flag: row.del_flag,
                time_configs: row.time_configs,
                device: {
                    name: row.device_name,
                    ip: row.device_ip,
                    online_status: row.online_status
                }
            })),
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        return res.status(500).json({
            code: 500,
            msg: "internal server down",
            data: null
        });
    }
};

exports.updateWiegandGroup = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { sn, group_id, time_configs, del_flag } = req.body;

        if (!id) {
            return res.status(400).json({
                code: 400,
                msg: "ID is required",
                data: null
            });
        }

        await client.query("BEGIN");

        // 1️⃣ Check if record exists
        const existingRes = await client.query(
            `SELECT * FROM wiegand_groups WHERE id = $1`,
            [id]
        );

        if (existingRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                code: 404,
                msg: "Group not found",
                data: null
            });
        }

        const current = existingRes.rows[0];

        const fields = [];
        const values = [];
        let index = 1;

        const newSn = sn ?? current.sn;
        const newGroupId = group_id ?? current.group_id;

        // 2️⃣ Check unique constraint if sn or group_id is being updated
        if (typeof sn !== "undefined" || typeof group_id !== "undefined") {
            const conflict = await client.query(
                `
        SELECT id FROM wiegand_groups
        WHERE sn = $1 AND group_id = $2 AND id != $3
        `,
                [newSn, newGroupId, id]
            );

            if (conflict.rows.length > 0) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    code: 409,
                    msg: "A group with this group_id already exists for this device",
                    data: null
                });
            }
        }

        // 3️⃣ Dynamic update fields

        if (typeof sn !== "undefined") {
            fields.push(`sn = $${index++}`);
            values.push(sn);
        }

        if (typeof group_id !== "undefined") {
            fields.push(`group_id = $${index++}`);
            values.push(group_id);
        }

        if (typeof time_configs !== "undefined") {
            let parsed;

            try {
                parsed =
                    typeof time_configs === "string"
                        ? JSON.parse(time_configs)
                        : time_configs;
            } catch {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    code: 400,
                    msg: "Invalid JSON format for time_configs",
                    data: null
                });
            }

            if (!Array.isArray(parsed)) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    code: 400,
                    msg: "time_configs must be an array",
                    data: null
                });
            }

            fields.push(`time_configs = $${index++}`);
            values.push(JSON.stringify(parsed));   // 🔥 critical fix
        }


        if (typeof del_flag !== "undefined") {
            fields.push(`del_flag = $${index++}`);
            values.push(Boolean(del_flag));
        }

        // Always update timestamp
        fields.push(`timestamp = $${index++}`);
        values.push(Date.now());

        // Always update updated_at
        fields.push(`updated_at = now()`);

        // Prevent empty updates
        if (fields.length <= 2) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                code: 400,
                msg: "No valid fields provided for update",
                data: null
            });
        }

        values.push(id);
        console.log("Final values being sent to DB:", values);

        const updateQuery = `
      UPDATE wiegand_groups
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *;
    `;

        const result = await client.query(updateQuery, values);

        await client.query("COMMIT");

        return res.status(200).json({
            code: 0,
            msg: "Success",
            data: result.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Failed to update Wiegand group:", error);

        return res.status(500).json({
            code: 500,
            msg: "Failed to update group",
            data: null
        });
    } finally {
        client.release();
    }
};



exports.softDeleteWiegandGroup = async (req, res) => {
    const client = await pool.connect();

    try {
        const { group_id, sn } = req.body;

        if (!group_id || !sn) {
            return res.status(400).json({
                code: 400,
                msg: `group_id ,sn required `,
                data: null
            });
        }

        await client.query("BEGIN");

        // Check existence
        const check = await client.query(
            `SELECT id FROM wiegand_groups WHERE group_id = $1 AND sn = $2`,
            [group_id, sn]
        );

        if (check.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                code: 404,
                msg: "not deleted",
                data: null
            });
        }

        // Soft delete
        await client.query(
            `
      UPDATE wiegand_groups
      SET 
        del_flag = true,
        timestamp = $1,
        updated_at = now()
      WHERE group_id = $2 AND sn = $3
      `,
            [Date.now(), group_id, sn]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            code: 0,
            msg: "Group soft delete successful",
            data: null
        });

    } catch (error) {
        await client.query("ROLLBACK");

        return res.status(500).json({
            code: 500,
            msg: "internal server  down",
            data: null
        });
    } finally {
        client.release();
    }
};
