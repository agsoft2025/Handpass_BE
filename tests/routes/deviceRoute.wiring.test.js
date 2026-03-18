jest.mock("../../src/controllers/device.controller", () => ({
  updateDeviceStatus: jest.fn((req, res) => res.status(200).json({ route: "updateDeviceStatus" })),
  fetchAllConnectDevices: jest.fn((req, res) => res.status(200).json({ route: "fetchAllConnectDevices" })),
  deviceGetUsers: jest.fn((req, res) => res.status(200).json({ route: "deviceGetUsers" })),
  getPassRecordsByDeviceSn: jest.fn((req, res) => res.status(200).json({ route: "getPassRecordsByDeviceSn" })),
  connect: jest.fn((req, res) => res.status(200).json({ route: "connect" })),
  deleteUser: jest.fn((req, res) => res.status(200).json({ route: "deleteUser" })),
  queryUsers: jest.fn((req, res) => res.status(200).json({ route: "queryUsers" })),
  checkRegistration: jest.fn((req, res) => res.status(200).json({ route: "checkRegistration" })),
  queryUserImages: jest.fn((req, res) => res.status(200).json({ route: "queryUserImages" })),
  firmwareUpgrade: jest.fn((req, res) => res.status(200).json({ route: "firmwareUpgrade" })),
  passList: jest.fn((req, res) => res.status(200).json({ route: "passList" })),
  queryBatchImportPath: jest.fn((req, res) => res.status(200).json({ route: "queryBatchImportPath" })),
  queryWiegandGroup: jest.fn((req, res) => res.status(200).json({ route: "queryWiegandGroup" })),
  queryUserWiegand: jest.fn((req, res) => res.status(200).json({ route: "queryUserWiegand" })),
  connectDeviceController: jest.fn((req, res) => res.status(200).json({ route: "connectDeviceController" })),
  updateDevice: jest.fn((req, res) => res.status(200).json({ route: "updateDevice" })),
  fetchSingleDevice: jest.fn((req, res) => res.status(200).json({ route: "fetchSingleDevice" })),
  deleteDevice: jest.fn((req, res) => res.status(200).json({ route: "deleteDevice" }))
}));
jest.mock("../../src/controllers/user.controller", () => ({
  addUserData: jest.fn((req, res) => res.status(200).json({ route: "addUserData" }))
}));

const express = require("express");
const request = require("supertest");
const deviceController = require("../../src/controllers/device.controller");
const userController = require("../../src/controllers/user.controller");
const router = require("../../src/routes/device.route");

const app = express();
app.use(express.json());
app.use("/v1", router);

describe("Device Route Wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["post", "/v1/device/updateStatus", "updateDeviceStatus"],
    ["post", "/v1/device/getAll", "fetchAllConnectDevices"],
    ["post", "/v1/device/getUsers", "deviceGetUsers"],
    ["post", "/v1/device/getPassRecords", "getPassRecordsByDeviceSn"],
    ["post", "/v1/delete", "deleteUser"],
    ["post", "/v1/query", "queryUsers"],
    ["post", "/v1/check_registration", "checkRegistration"],
    ["post", "/v1/query_images", "queryUserImages"],
    ["post", "/v1/firmware_upgrade", "firmwareUpgrade"],
    ["post", "/v1/pass_list", "passList"],
    ["post", "/v1/query_batch_import_path", "queryBatchImportPath"],
    ["post", "/v1/query_wiegand_group", "queryWiegandGroup"],
    ["post", "/v1/query_user_wiegand", "queryUserWiegand"],
    ["put", "/v1/connect/1", "updateDevice"],
    ["get", "/v1/connect/1", "fetchSingleDevice"],
    ["delete", "/v1/connect/1", "deleteDevice"]
  ])("should wire %s %s to %s", async (method, path, handlerName) => {
    const res = await request(app)[method](path).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route: handlerName });
    expect(deviceController[handlerName]).toHaveBeenCalled();
  });

  test("should wire POST /v1/add to userController.addUserData", async () => {
    const res = await request(app).post("/v1/add").send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route: "addUserData" });
    expect(userController.addUserData).toHaveBeenCalled();
  });

  test("should resolve POST /v1/connect to the first registered connect handler", async () => {
    const res = await request(app).post("/v1/connect").send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route: "connect" });
    expect(deviceController.connect).toHaveBeenCalled();
    expect(deviceController.connectDeviceController).not.toHaveBeenCalled();
  });
});
