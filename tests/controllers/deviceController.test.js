jest.mock("../../src/config/database", () => ({
  pool: {
    query: jest.fn()
  }
}));
jest.mock("express-validator", () => ({
  validationResult: jest.fn()
}));
jest.mock("../../src/services/device.service", () => ({
  connectDevice: jest.fn(),
  addInmateService: jest.fn()
}));
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

const { pool } = require("../../src/config/database");
const { validationResult } = require("express-validator");
const { connectDevice } = require("../../src/services/device.service");
const fs = require("fs");
const deviceController = require("../../src/controllers/device.controller");
const userController = require("../../src/controllers/user.controller");

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  send: jest.fn()
});

describe("Device Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });
    fs.existsSync.mockReturnValue(true);
  });

  describe("updateDeviceStatus", () => {
    test("should auto-register a new device when serial number does not exist", async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              sn: "SN001",
              device_ip: "192.168.1.10",
              online_status: 1
            }
          ]
        });

      const req = {
        body: {
          sn: "SN001",
          online_status: 1,
          device_ip: "192.168.1.10"
        }
      };
      const res = {
        json: jest.fn()
      };

      await deviceController.updateDeviceStatus(req, res);

      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM devices WHERE sn = $1 LIMIT 1",
        ["SN001"]
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO devices"),
        ["SN001", "192.168.1.10", 1, expect.any(Date)]
      );
      expect(res.json).toHaveBeenCalledWith({
        code: 0,
        msg: "success",
        data: {
          device: {
            id: 1,
            sn: "SN001",
            device_ip: "192.168.1.10",
            online_status: 1
          },
          isNew: true
        }
      });
    });

    test("should update an existing device status", async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{ id: 2, sn: "SN002" }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              sn: "SN002",
              device_ip: "10.0.0.5",
              online_status: 0
            }
          ]
        });

      const req = {
        body: {
          sn: "SN002",
          online_status: 0,
          device_ip: "10.0.0.5"
        }
      };
      const res = {
        json: jest.fn()
      };

      await deviceController.updateDeviceStatus(req, res);

      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM devices WHERE sn = $1 LIMIT 1",
        ["SN002"]
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE devices"),
        [0, "10.0.0.5", expect.any(Date), "SN002"]
      );
      expect(res.json).toHaveBeenCalledWith({
        code: 0,
        msg: "success",
        data: {
          device: {
            id: 2,
            sn: "SN002",
            device_ip: "10.0.0.5",
            online_status: 0
          },
          isNew: false
        }
      });
    });
  });

  test("fetchAllConnectDevices should return paginated device list", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, sn: "SN001", device_name: "Gate 1" }]
      })
      .mockResolvedValueOnce({
        rows: [{ total: "1" }]
      });

    const req = {
      query: {
        page: 1,
        limit: 10,
        search: "SN",
        status: "1"
      }
    };
    const res = createRes();

    await deviceController.fetchAllConnectDevices(req, res);

    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: "Devices fetched successfully",
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1
      },
      data: [{ id: 1, sn: "SN001", device_name: "Gate 1" }]
    });
  });

  test("deviceGetUsers should return users mapped to device groups", async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "group-1" }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 4, user_id: "U1", name: "User 1", wiegand_flag: 1, admin_auth: 0 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "1" }]
      });

    const req = {
      body: {
        sn: "SN001",
        page: 1,
        limit: 10,
        search: ""
      }
    };
    const res = createRes();

    await deviceController.deviceGetUsers(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        users: [{ id: 4, user_id: "U1", name: "User 1", wiegand_flag: 1, admin_auth: 0 }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    });
  });

  test("getPassRecordsByDeviceSn should return device pass records", async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 1, sn: "SN001", name: "User 1" }]
    });

    const req = {
      body: { sn: "SN001" }
    };
    const res = createRes();

    await deviceController.getPassRecordsByDeviceSn(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        passRecordList: [{ id: 1, sn: "SN001", name: "User 1" }],
        count: 1
      }
    });
  });

  test("connect should upsert device and return timestamps", async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ max_ts: 123 }] })
      .mockResolvedValueOnce({ rows: [{ max_ts: 456 }] })
      .mockResolvedValueOnce({ rows: [{ max_ts: 789 }] })
      .mockResolvedValueOnce({ rows: [{ max_ts: 999 }] });

    const req = {
      body: { sn: "SN001" },
      ip: "::ffff:127.0.0.1",
      connection: { remoteAddress: "::ffff:127.0.0.1" }
    };
    const res = createRes();

    await deviceController.connect(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      register_timestamp: "456",
      wiegand_group_timestamp: "789",
      user_wiegand_timestamp: "999"
    });
  });

  test("deleteUser should remove a registered user", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({});

    const req = {
      body: { sn: "SN001", id: "U1" }
    };
    const res = createRes();

    await deviceController.deleteUser(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success"
    });
  });

  test("queryUsers should return incremental sync users", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: "U1",
          wiegand_flag: 1,
          admin_auth: 0,
          del_flag: 0,
          timestamp: 1000
        }
      ]
    });

    const req = {
      body: { sn: "SN001", device_timestamp: "999" }
    };
    const res = createRes();

    await deviceController.queryUsers(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        idDataList: [
          {
            id: "U1",
            wiegand_flag: 1,
            admin_auth: 0,
            del_flag: false,
            timestamp: 1000
          }
        ]
      }
    });
  });

  test("checkRegistration should return registration status", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ is_registered: true }]
    });

    const req = {
      body: { sn: "SN001", id: "U1" }
    };
    const res = createRes();

    await deviceController.checkRegistration(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        is_registered: true
      }
    });
  });

  test("queryUserImages should return palm images", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ name: "User 1", image_left: "left", image_right: "right" }]
    });

    const req = {
      body: { sn: "SN001", id: "U1" }
    };
    const res = createRes();

    await deviceController.queryUserImages(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        name: "User 1",
        image_left: "left",
        image_right: "right"
      }
    });
  });

  test("firmwareUpgrade should return upgrade metadata", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ latest_firmware_version: "1.2.0", firmware_url: "https://fw.bin" }]
    });

    const req = {
      body: { sn: "SN001", version: "1.0.0" }
    };
    const res = createRes();

    await deviceController.firmwareUpgrade(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        need: true,
        url: "https://fw.bin"
      }
    });
  });

  test("passList should insert a valid access record", async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});

    const req = {
      body: {
        sn: "SN001",
        name: "User 1",
        id: "U1",
        type: "left",
        device_date_time: "2026-03-13T10:00:00.000Z"
      }
    };
    const res = createRes();

    await deviceController.passList(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success"
    });
  });

  test("queryBatchImportPath should return import url", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ batch_import_url: "https://example.com/batch.csv" }]
    });

    const req = {
      body: { sn: "SN001" }
    };
    const res = createRes();

    await deviceController.queryBatchImportPath(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        url: "https://example.com/batch.csv"
      }
    });
  });

  test("queryWiegandGroup should return changed group records", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          group_id: "G1",
          timestamp: 101,
          del_flag: false,
          time_configs: [{ day: "mon" }]
        }
      ]
    });

    const req = {
      body: { sn: "SN001", device_timestamp: 100 }
    };
    const res = createRes();

    await deviceController.queryWiegandGroup(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        idDataList: [
          {
            id: "G1",
            timestamp: "101",
            del_flag: false,
            time_configs: [{ day: "mon" }]
          }
        ]
      }
    });
  });

  test("queryUserWiegand should return changed user-group mappings", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: "U1",
          timestamp: 202,
          del_flag: false,
          group_id: "G1"
        }
      ]
    });

    const req = {
      body: { sn: "SN001", device_timestamp: 100 }
    };
    const res = createRes();

    await deviceController.queryUserWiegand(req, res);

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        idDataList: [
          {
            user_id: "U1",
            timestamp: "202",
            del_flag: false,
            group_id: "G1"
          }
        ]
      }
    });
  });

  test("connectDeviceController should normalize ip and return connected device", async () => {
    connectDevice.mockResolvedValueOnce({
      data: [{ id: 1, sn: "SN001" }]
    });

    const req = {
      body: { sn: "SN001" },
      ip: "::ffff:10.0.0.8"
    };
    const res = createRes();

    await deviceController.connectDeviceController(req, res);

    expect(connectDevice).toHaveBeenCalledWith("SN001", "10.0.0.8");
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success",
      data: {
        sn: "SN001",
        online: true,
        ip: "10.0.0.8",
        device: { id: 1, sn: "SN001" }
      }
    });
  });

  test("updateDevice should update a device record", async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: "1", device_name: "Gate 1" }]
    });

    const req = {
      params: { id: "1" },
      body: { device_name: "Gate 1" },
      user: { id: "admin" }
    };
    const res = createRes();

    await deviceController.updateDevice(req, res);

    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: "Device updated successfully",
      data: { id: "1", device_name: "Gate 1" }
    });
  });

  test("fetchSingleDevice should return one device", async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: "1", sn: "SN001" }]
    });

    const req = {
      params: { id: "1" }
    };
    const res = createRes();

    await deviceController.fetchSingleDevice(req, res);

    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: "Device fetched successfully",
      data: { id: "1", sn: "SN001" }
    });
  });

  test("deleteDevice should remove one device", async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});

    const req = {
      params: { id: "1" }
    };
    const res = createRes();

    await deviceController.deleteDevice(req, res);

    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: "Device deleted successfully"
    });
  });
});

describe("User Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });
  });

  test("addUserData should register a device user", async () => {
    fs.existsSync.mockReturnValue(false);
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "generated-id" }] })
      .mockResolvedValueOnce({});

    const req = {
      body: {
        sn: "SN001",
        id: "U1",
        name: "User 1",
        image_left: "base64,left",
        image_right: "base64,right",
        wiegand_flag: 1,
        admin_auth: 0
      }
    };
    const res = createRes();

    await userController.addUserData(req, res);

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      msg: "success"
    });
  });
});
