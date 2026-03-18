jest.mock("../../src/middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1, role: "admin", email: "admin@example.com" };
    next();
  })
}));

jest.mock("../../src/controllers/report.controller", () => ({
  deviceAccessReport: jest.fn((req, res) =>
    res.status(200).json({ route: "deviceAccessReport" })
  )
}));

const express = require("express");
const request = require("supertest");
const { authenticate } = require("../../src/middleware/auth");
const reportController = require("../../src/controllers/report.controller");
const router = require("../../src/routes/report.routes");

const app = express();
app.use(express.json());
app.use("/api/report", router);

describe("Report Route", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should wire POST /api/report/access-list to deviceAccessReport", async () => {
    const res = await request(app)
      .post("/api/report/access-list")
      .send({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route: "deviceAccessReport" });
    expect(authenticate).toHaveBeenCalled();
    expect(reportController.deviceAccessReport).toHaveBeenCalled();
  });

  test("should block POST /api/report/access-list when authenticate rejects", async () => {
    authenticate.mockImplementationOnce((req, res) => {
      res.status(401).json({ message: "Access denied" });
    });

    const res = await request(app)
      .post("/api/report/access-list")
      .send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Access denied" });
    expect(reportController.deviceAccessReport).not.toHaveBeenCalled();
  });
});
