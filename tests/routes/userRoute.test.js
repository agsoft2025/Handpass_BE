jest.mock("../../src/middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1, role: "admin", email: "admin@example.com" };
    next();
  })
}));

jest.mock("../../src/controllers/user.controller", () => ({
  fetchAllUsers: jest.fn((req, res) =>
    res.status(200).json({ route: "fetchAllUsers" })
  ),
  fetchAllUsersWithGroup: jest.fn((req, res) =>
    res.status(200).json({ route: "fetchAllUsersWithGroup" })
  ),
  deleteUsersWithGroup: jest.fn((req, res) =>
    res.status(200).json({ route: "deleteUsersWithGroup", id: req.params.id })
  ),
  fetchSingleUsersWithGroup: jest.fn((req, res) =>
    res.status(200).json({ route: "fetchSingleUsersWithGroup", id: req.params.id })
  ),
  updateUsersPersmissions: jest.fn((req, res) =>
    res.status(200).json({ route: "updateUsersPersmissions", id: req.params.id })
  ),
  updateUsersDetails: jest.fn((req, res) =>
    res.status(200).json({ route: "updateUsersDetails", id: req.params.id })
  )
}));

const express = require("express");
const request = require("supertest");
const { authenticate } = require("../../src/middleware/auth");
const usersController = require("../../src/controllers/user.controller");
const router = require("../../src/routes/user.routes");

const app = express();
app.use(express.json());
app.use("/api/users", router);

describe("User Route", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["get", "/api/users", "fetchAllUsers", { route: "fetchAllUsers" }],
    ["get", "/api/users/with-group", "fetchAllUsersWithGroup", { route: "fetchAllUsersWithGroup" }],
    ["delete", "/api/users/11", "deleteUsersWithGroup", { route: "deleteUsersWithGroup", id: "11" }],
    ["delete", "/api/users/with-group/22", "deleteUsersWithGroup", { route: "deleteUsersWithGroup", id: "22" }],
    ["get", "/api/users/with-group/33", "fetchSingleUsersWithGroup", { route: "fetchSingleUsersWithGroup", id: "33" }],
    ["put", "/api/users/update-permission/44", "updateUsersPersmissions", { route: "updateUsersPersmissions", id: "44" }],
    ["put", "/api/users/update-user/55", "updateUsersDetails", { route: "updateUsersDetails", id: "55" }]
  ])("should wire %s %s to %s", async (method, path, handlerName, expectedBody) => {
    const req = request(app)[method](path);
    if (method === "put") {
      req.send({ any: "payload" });
    }

    const res = await req;

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expectedBody);
    expect(authenticate).toHaveBeenCalled();
    expect(usersController[handlerName]).toHaveBeenCalled();
  });
});
