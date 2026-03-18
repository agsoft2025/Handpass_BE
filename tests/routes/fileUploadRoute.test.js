jest.mock("../../src/middleware/auth", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 99, role: "admin", email: "admin@example.com" };
    next();
  })
}));

const mockMulterFieldsMiddleware = jest.fn((req, res, next) => {
  req.files = {
    files: [{ originalname: "doc1.pdf" }],
    pro_pic: [{ originalname: "profile.png" }]
  };
  next();
});

const mockFields = jest.fn(() => mockMulterFieldsMiddleware);

jest.mock("../../src/utils/fileUpload", () => ({
  fields: mockFields
}));

jest.mock("../../src/controllers/fileUpload.controller", () => ({
  fileUploadControllerFun: jest.fn((req, res) =>
    res.status(200).json({
      route: "fileUploadControllerFun",
      userId: req.user?.id,
      fileFields: Object.keys(req.files || {})
    })
  ),
  fetchFileController: jest.fn((req, res) =>
    res.status(200).json({ route: "fetchFileController" })
  ),
  deleteFileController: jest.fn((req, res) =>
    res.status(200).json({
      route: "deleteFileController",
      fileId: req.params.fileId
    })
  )
}));

const express = require("express");
const request = require("supertest");
const upload = require("../../src/utils/fileUpload");
const { authenticate } = require("../../src/middleware/auth");
const fileUploadController = require("../../src/controllers/fileUpload.controller");
const router = require("../../src/routes/fileUpload.route");

const app = express();
app.use(express.json());
app.use("/api/upload", router);

describe("File Upload Route", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should configure multer fields for files and pro_pic", () => {
    expect(upload.fields).toHaveBeenCalledWith([
      { name: "files", maxCount: 10 },
      { name: "pro_pic", maxCount: 1 }
    ]);
  });

  test("should wire POST /api/upload to fileUploadControllerFun", async () => {
    const res = await request(app).post("/api/upload").send({ remark: "test" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      route: "fileUploadControllerFun",
      userId: 99,
      fileFields: ["files", "pro_pic"]
    });
    expect(authenticate).toHaveBeenCalled();
    expect(fileUploadController.fileUploadControllerFun).toHaveBeenCalled();
  });

  test("should wire GET /api/upload to fetchFileController", async () => {
    const res = await request(app).get("/api/upload");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route: "fetchFileController" });
    expect(authenticate).toHaveBeenCalled();
    expect(fileUploadController.fetchFileController).toHaveBeenCalled();
  });

  test("should wire DELETE /api/upload/:fileId to deleteFileController", async () => {
    const res = await request(app).delete("/api/upload/abc123");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      route: "deleteFileController",
      fileId: "abc123"
    });
    expect(authenticate).toHaveBeenCalled();
    expect(fileUploadController.deleteFileController).toHaveBeenCalled();
  });
});
