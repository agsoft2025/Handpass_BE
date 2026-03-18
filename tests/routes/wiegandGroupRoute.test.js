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

describe("Wiegand Group Api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should create a wiegand group from POST /v1/api/wiegand_groups", async () => {
    const now = 1760010000000;
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
            id: 21,
            group_id: "G1",
            sn: "SN001",
            timestamp: now,
            del_flag: false,
            time_configs: [{ day: "mon", start: "09:00", end: "18:00" }]
          }
        ]
      })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post("/v1/api/wiegand_groups")
      .send({
        group_id: "G1",
        sn: "SN001",
        time_configs: [{ day: "mon", start: "09:00", end: "18:00" }]
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 200,
      msg: "success",
      data: {
        id: 21,
        group_id: "G1",
        sn: "SN001",
        timestamp: String(now),
        del_flag: false,
        time_configs: [{ day: "mon", start: "09:00", end: "18:00" }]
      }
    });
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO wiegand_groups"),
      [
        "G1",
        "SN001",
        now,
        false,
        JSON.stringify([{ day: "mon", start: "09:00", end: "18:00" }])
      ]
    );
    expect(client.query).toHaveBeenNthCalledWith(3, "COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });

  test("should fetch wiegand groups from GET /v1/api/wiegand_groups", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            group_id: "G1",
            sn: "SN001",
            timestamp: 1760010000000,
            del_flag: false,
            time_configs: [{ day: "mon" }],
            device_name: "Main Gate",
            device_ip: "192.168.1.10",
            online_status: 1
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "1" }]
      });

    const res = await request(app)
      .get("/v1/api/wiegand_groups")
      .query({
        page: 1,
        limit: 10,
        search: "G1",
        sort_by: "wg.group_id",
        sort_order: "ASC",
        del_flag: 0,
        sn: "SN001"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 200,
      msg: "operation successful",
      data: [
        {
          id: 21,
          group_id: "G1",
          sn: "SN001",
          user_id: undefined,
          timestamp: "1760010000000",
          del_flag: false,
          time_configs: [{ day: "mon" }],
          device: {
            name: "Main Gate",
            ip: "192.168.1.10",
            online_status: 1
          }
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1
      }
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM wiegand_groups wg"),
      [false, "SN001", "%G1%", 10, 0]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT COUNT(*)"),
      [false, "SN001", "%G1%"]
    );
  });

  test("should update a wiegand group from PUT /v1/api/wiegand_groups/:id", async () => {
    const now = 1760011111111;
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
            id: 21,
            group_id: "G1",
            sn: "SN001",
            time_configs: [{ day: "mon" }],
            del_flag: false
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            group_id: "G2",
            sn: "SN002",
            time_configs: [{ day: "tue" }],
            del_flag: true,
            timestamp: now
          }
        ]
      })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .put("/v1/api/wiegand_groups/21")
      .send({
        sn: "SN002",
        group_id: "G2",
        time_configs: [{ day: "tue" }],
        del_flag: true
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 0,
      msg: "Success",
      data: {
        id: 21,
        group_id: "G2",
        sn: "SN002",
        time_configs: [{ day: "tue" }],
        del_flag: true,
        timestamp: now
      }
    });
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM wiegand_groups WHERE id = $1",
      ["21"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SELECT id FROM wiegand_groups"),
      ["SN002", "G2", "21"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("UPDATE wiegand_groups"),
      ["SN002", "G2", JSON.stringify([{ day: "tue" }]), true, now, "21"]
    );
    expect(client.query).toHaveBeenNthCalledWith(5, "COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });

  test("should soft delete a wiegand group from DELETE /v1/api/wiegand_groups/delete", async () => {
    const now = 1760012222222;
    jest.spyOn(Date, "now").mockReturnValue(now);

    const client = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 21 }]
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const res = await request(app)
      .delete("/v1/api/wiegand_groups/delete")
      .send({
        group_id: "G1",
        sn: "SN001"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 0,
      msg: "Group soft delete successful",
      data: null
    });
    expect(pool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT id FROM wiegand_groups WHERE group_id = $1 AND sn = $2",
      ["G1", "SN001"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE wiegand_groups"),
      [now, "G1", "SN001"]
    );
    expect(client.query).toHaveBeenNthCalledWith(4, "COMMIT");
    expect(client.release).toHaveBeenCalled();

    Date.now.mockRestore();
  });
});
