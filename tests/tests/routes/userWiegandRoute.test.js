jest.mock("../../../src/config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

jest.mock("../../../src/middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1, role: "admin", email: "admin@example.com" };
    next();
  }),
  authorizeRoles: jest.fn(() => (req, res, next) => next())
}));

const request = require("supertest");
const { pool } = require("../../../src/config/database");
const app = require("../../../src/app");

describe("User Wiegand Api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should create assignments from POST /v1/api/user_wiegands", async () => {
    const now = 1760000000000;
    jest.spyOn(Date, "now").mockReturnValue(now);

    const client = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "group-uuid-1", group_id: "G1" }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: "time-uuid-1", time_group_id: "TG001" }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN001",
            user_id: "U1",
            group_id: "G1",
            group_uuid: "group-uuid-1",
            time_group_id: "TG001",
            time_group_uuid: "time-uuid-1",
            timestamp: now,
            del_flag: false
          }
        ]
      })
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .post("/v1/api/user_wiegands")
      .send({
        sn: "SN001",
        user_id: "U1",
        assignments: [{ group_id: "G1", time_group_id: "TG001" }]
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      message: "Assignments processed",
      summary: {
        total: 1,
        inserted: 1,
        skipped: 0
      },
      data: [
        {
          id: 11,
          sn: "SN001",
          user_id: "U1",
          group_id: "G1",
          group_uuid: "group-uuid-1",
          time_group_id: "TG001",
          time_group_uuid: "time-uuid-1",
          timestamp: now,
          del_flag: false
        }
      ],
      skipped: []
    });
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });

  test("should fetch user wiegand mappings from GET /v1/api/user_wiegands", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN001",
            user_id: "U1",
            group_id: "G1",
            time_group_id: "TG001",
            device_name: "Main Gate",
            del_flag: false,
            timestamp: 1760000000000
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "1" }]
      });

    const res = await request(app)
      .get("/v1/api/user_wiegands")
      .query({
        page: 1,
        limit: 10,
        search: "U1",
        del_flag: "false",
        sort_by: "user_id",
        sort_order: "ASC"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total_records).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: 11,
      sn: "SN001",
      user_id: "U1",
      group_id: "G1",
      time_group_id: "TG001",
      device_name: "Main Gate",
      del_flag: false,
      timestamp: 1760000000000
    });
  });

  test("should soft delete one assignment from DELETE /v1/api/user_wiegands/assignment", async () => {
    const now = 1760001234567;
    jest.spyOn(Date, "now").mockReturnValue(now);

    const client = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 11, sn: "SN001", user_id: "U1", group_id: "G1", time_group_id: "TG001" }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 11, sn: "SN001", user_id: "U1", group_id: "G1", time_group_id: "TG001", del_flag: true }]
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .delete("/v1/api/user_wiegands/assignment")
      .send({
        user_id: "U1",
        id: "11"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Assignment deleted successfully");
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });

  test("should update a user wiegand mapping from PUT /v1/api/user_wiegands/:id", async () => {
    const now = 1760001111111;
    jest.spyOn(Date, "now").mockReturnValue(now);

    const client = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN001",
            user_id: "U1",
            group_id: "G1",
            group_uuid: "old-group-uuid",
            time_group_id: "TG001",
            time_group_uuid: "old-time-uuid",
            del_flag: false
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ id: "new-group-uuid" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN002",
            user_id: "U1",
            group_id: "G2",
            group_uuid: "new-group-uuid",
            time_group_id: "TG002",
            time_group_uuid: "old-time-uuid",
            timestamp: now,
            del_flag: false
          }
        ]
      })
      .mockResolvedValueOnce({}) // device_group_assignments upsert
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .put("/v1/api/user_wiegands/11")
      .send({
        sn: "SN002",
        group_id: "G2",
        time_group_id: "TG002"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("User Wiegand updated successfully");
    expect(res.body.data).toMatchObject({
      id: 11,
      sn: "SN002",
      user_id: "U1",
      group_id: "G2",
      group_uuid: "new-group-uuid",
      time_group_id: "TG002",
      time_group_uuid: "old-time-uuid",
      timestamp: now,
      del_flag: false
    });
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });
});
