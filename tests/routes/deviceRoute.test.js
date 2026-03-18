jest.mock("../../src/config/database", () => ({
  pool: {
    query: jest.fn()
  }
}));
jest.mock("express-validator", () => ({
  validationResult: jest.fn()
}));

const request = require("supertest");
const { pool } = require("../../src/config/database");
const { validationResult } = require("express-validator");
const app = require("../../src/app");

describe("Device Api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });
  });

  test("should auto-register a device from POST /v1/device/updateStatus", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            sn: "SN-NEW",
            device_ip: "172.16.0.20",
            online_status: 1
          }
        ]
      });

    const res = await request(app)
      .post("/v1/device/updateStatus")
      .send({
        sn: "SN-NEW",
        online_status: 1,
        device_ip: "172.16.0.20"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 0,
      msg: "success",
      data: {
        device: {
          id: 5,
          sn: "SN-NEW",
          device_ip: "172.16.0.20",
          online_status: 1
        },
        isNew: true
      }
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      "SELECT * FROM devices WHERE sn = $1 LIMIT 1",
      ["SN-NEW"]
    );
  });

  test("should update existing device from POST /v1/device/updateStatus", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 7, sn: "SN-EXIST" }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            sn: "SN-EXIST",
            device_ip: "172.16.0.21",
            online_status: 0
          }
        ]
      });

    const res = await request(app)
      .post("/v1/device/updateStatus")
      .send({
        sn: "SN-EXIST",
        online_status: 0,
        device_ip: "172.16.0.21"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 0,
      msg: "success",
      data: {
        device: {
          id: 7,
          sn: "SN-EXIST",
          device_ip: "172.16.0.21",
          online_status: 0
        },
        isNew: false
      }
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      "SELECT * FROM devices WHERE sn = $1 LIMIT 1",
      ["SN-EXIST"]
    );
  });
});
