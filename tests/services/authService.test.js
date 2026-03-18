jest.mock("../../src/database/sql/sqlFunction", () => ({
  sqlQueryFun: jest.fn()
}));
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn()
}));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sqlQueryFun } = require("../../src/database/sql/sqlFunction");
const {
  registerUserService,
  loginUserService
} = require("../../src/services/auth.services");

describe("Auth Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("registerUserService", () => {
    test("should return error if name is missing", async () => {
      const result = await registerUserService({
        email: "test@gmail.com",
        password: "correct",
        role: "admin"
      });

      expect(result.status).toBe(false);
      expect(result.message).toBe("Name field required");
      expect(sqlQueryFun).not.toHaveBeenCalled();
    });

    test("should return error if email exists", async () => {
      sqlQueryFun.mockResolvedValueOnce([{ id: 1 }]);

      const result = await registerUserService({
        name: "test",
        email: "test@gmail.com",
        password: "correct",
        role: "admin"
      });

      expect(result.status).toBe(false);
      expect(result.message).toBe("Email already exist");
    });
  });

  describe("loginUserService", () => {
    test("should return error if email is missing", async () => {
      const result = await loginUserService({
        password: "correct"
      });

      expect(result).toEqual({
        status: false,
        data: [],
        message: "email field required"
      });
      expect(sqlQueryFun).not.toHaveBeenCalled();
    });

    test("should return error if password is missing", async () => {
      const result = await loginUserService({
        email: "test@gmail.com"
      });

      expect(result).toEqual({
        status: false,
        data: [],
        message: "password field required"
      });
      expect(sqlQueryFun).not.toHaveBeenCalled();
    });

    test("should return error when account does not exist", async () => {
      sqlQueryFun.mockResolvedValueOnce([]);

      const result = await loginUserService({
        email: "missing@gmail.com",
        password: "correct"
      });

      expect(sqlQueryFun).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE email = $1",
        ["missing@gmail.com"]
      );
      expect(result).toEqual({
        status: false,
        data: [],
        message: "No account found with this email address"
      });
    });

    test("should return error when password is incorrect", async () => {
      sqlQueryFun.mockResolvedValueOnce([
        {
          id: 1,
          role: "admin",
          name: "Test User",
          password_hash: "hashed-password"
        }
      ]);
      bcrypt.compare.mockResolvedValueOnce(false);

      const result = await loginUserService({
        email: "test@gmail.com",
        password: "wrong-password"
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        "wrong-password",
        "hashed-password"
      );
      expect(result).toEqual({
        status: false,
        message: "The password you entered is incorrect"
      });
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("should return login payload when credentials are valid", async () => {
      sqlQueryFun.mockResolvedValueOnce([
        {
          id: 7,
          role: "admin",
          name: "Test User",
          password_hash: "hashed-password"
        }
      ]);
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce("signed-token");

      const result = await loginUserService({
        email: "test@gmail.com",
        password: "correct-password"
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 7, role: "admin", email: "test@gmail.com" },
        "test-secret",
        { expiresIn: "30d" }
      );
      expect(result).toEqual({
        status: true,
        data: {
          role: "admin",
          email: "test@gmail.com",
          name: "Test User",
          token: "signed-token"
        },
        message: "You have logged in successfully"
      });
    });
  });
});
