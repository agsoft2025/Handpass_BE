jest.mock("../../src/config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

jest.mock("../../src/middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1, role: "admin", email: "admin@example.com" };
    next();
  }),
  authorizeRoles: jest.fn(() => (req, res, next) => next())
}));

const request = require("supertest");
const { pool } = require("../../src/config/database");
const app = require("../../src/app");

describe("User Wiegand Api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should create or upsert a user wiegand mapping from POST /v1/api/user_wiegands", async () => {
    const now = 1760000000000;
    jest.spyOn(Date, "now").mockReturnValue(now);

    pool.query
      .mockResolvedValueOnce({
        rows: [{ group_id: "G1", id: "group-uuid-1" }]
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN001",
            user_id: "U1",
            group_id: "G1",
            group_uuid: "group-uuid-1",
            timestamp: now,
            del_flag: false
          }
        ]
      });

    const res = await request(app)
      .post("/v1/api/user_wiegands")
      .send({
        sn: "SN001",
        user_id: "U1",
        group_id: "G1"
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: 11,
        sn: "SN001",
        user_id: "U1",
        group_id: "G1",
        group_uuid: "group-uuid-1",
        timestamp: now,
        del_flag: false
      }
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      "SELECT group_id, id FROM wiegand_groups WHERE group_id = $1",
      ["G1"]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      "SELECT id FROM user_wiegands WHERE user_id = $1 AND sn = $2",
      ["U1", "SN001"]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO user_wiegands"),
      ["SN001", "U1", "G1", "group-uuid-1", now, false]
    );

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
    expect(res.body).toEqual({
      success: true,
      total_records: 1,
      current_page: 1,
      total_pages: 1,
      data: [
        {
          id: 11,
          sn: "SN001",
          user_id: "U1",
          group_id: "G1",
          device_name: "Main Gate",
          del_flag: false,
          timestamp: 1760000000000
        }
      ]
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM user_wiegands uw"),
      [false, "%U1%", 10, 0]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT COUNT(*)"),
      [false, "%U1%"]
    );
  });

  test("should soft delete a user wiegand mapping from DELETE /v1/api/user_wiegands/:id", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 11 }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN001",
            user_id: "U1",
            group_id: "G1",
            del_flag: true
          }
        ]
      });

    const res = await request(app).delete("/v1/api/user_wiegands/11");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "User Wiegand soft deleted successfully",
      data: {
        id: 11,
        sn: "SN001",
        user_id: "U1",
        group_id: "G1",
        del_flag: true
      }
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT id"),
      ["11"]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE user_wiegands"),
      ["11"]
    );
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
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN001",
            user_id: "U1",
            group_id: "G1",
            group_uuid: "old-group-uuid",
            del_flag: false
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ id: "new-group-uuid" }]
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            sn: "SN002",
            user_id: "U1",
            group_id: "G2",
            group_uuid: "new-group-uuid",
            timestamp: now,
            del_flag: false
          }
        ]
      })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .put("/v1/api/user_wiegands/11")
      .send({
        sn: "SN002",
        group_id: "G2"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "User Wiegand updated successfully",
      data: {
        id: 11,
        sn: "SN002",
        user_id: "U1",
        group_id: "G2",
        group_uuid: "new-group-uuid",
        timestamp: now,
        del_flag: false
      }
    });
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM user_wiegands"),
      ["11"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("FROM wiegand_groups"),
      ["G2"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("WHERE user_id = $1"),
      ["U1", "SN002", "11"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("UPDATE user_wiegands"),
      ["SN002", "U1", "G2", "new-group-uuid", now, "11"]
    );
    expect(client.query).toHaveBeenNthCalledWith(6, "COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });
});
