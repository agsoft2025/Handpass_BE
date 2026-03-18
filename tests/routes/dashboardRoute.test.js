jest.mock("../../src/middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1, role: "admin", email: "admin@example.com" };
    next();
  })
}));

jest.mock("../../src/controllers/dashboard.controller", () => ({
  fetchDashboard: jest.fn((req, res) =>
    res.status(200).json({ route: "fetchDashboard" })
  )
}));

const express = require("express");
const request = require("supertest");
const { authenticate } = require("../../src/middleware/auth");
const dashboardController = require("../../src/controllers/dashboard.controller");
const router = require("../../src/routes/dashboard.route");

const app = express();
app.use(express.json());
app.use("/api/dashboard", router);

describe("Dashboard Route", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should wire GET /api/dashboard to fetchDashboard", async () => {
    const res = await request(app).get("/api/dashboard");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route: "fetchDashboard" });
    expect(authenticate).toHaveBeenCalled();
    expect(dashboardController.fetchDashboard).toHaveBeenCalled();
  });
});
