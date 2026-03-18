jest.mock("../../src/config/database", () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.unmock("../../src/controllers/report.controller");

const { pool } = require("../../src/config/database");
const reportController = require("../../src/controllers/report.controller");

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  end: jest.fn()
});

describe("Report Controller - deviceAccessReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return 400 for invalid report_type", async () => {
    const req = { body: { report_type: "unknown" } };
    const res = createRes();

    await reportController.deviceAccessReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("should return paginated access log report", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            sn: "SN-001",
            device_name: "Gate A",
            name: "John",
            user_id: "U-1",
            palm_type: "left",
            group_id: "G-1",
            device_date_time: "2026-03-01T10:00:00.000Z",
            created_at: "2026-03-01T10:01:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ count: "2" }] });

    const req = {
      body: {
        report_type: "access_log_report",
        sortField: "device_time",
        sortOrder: "asc",
        sn: "SN-001",
        page: 1,
        limit: 10
      }
    };
    const res = createRes();

    await reportController.deviceAccessReport(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("ORDER BY dal.device_date_time ASC"),
      ["SN-001", 10, 0]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT COUNT(*)"),
      ["SN-001"]
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        report_type: "access_log_report",
        page: 1,
        limit: 10,
        totalCount: 2,
        data: expect.any(Array)
      })
    );
  });

  test("should return csv when format=csv", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "u1",
            user_name: "Alice",
            email: "alice@example.com",
            phone_number: "9999999999",
            role: "inmate",
            sn: "SN-1",
            group_id: "G-1",
            user_id: "USR-1",
            wiegand_flag: 0,
            admin_auth: 0,
            created_at: "2026-03-01T00:00:00.000Z"
          }
        ]
      });

    const req = { body: { report_type: "user_report", format: "csv" } };
    const res = createRes();

    await reportController.deviceAccessReport(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=user_report.csv"
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining("user_name"));
  });

  test("should return 500 on query error", async () => {
    pool.query.mockRejectedValueOnce(new Error("db down"));

    const req = { body: { report_type: "user_report" } };
    const res = createRes();

    await reportController.deviceAccessReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Internal server error" })
    );
  });
});
