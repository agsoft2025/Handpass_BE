jest.mock("../../src/services/auth.services", () => ({
  registerUserService: jest.fn(),
  loginUserService: jest.fn()
}));
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));
jest.mock("../../src/database/sql/sqlFunction", () => ({
  sqlQueryFun: jest.fn()
}));

const authServices = require("../../src/services/auth.services");
const authController = require("../../src/controllers/auth.controller");
const jwt = require("jsonwebtoken");
const { sqlQueryFun } = require("../../src/database/sql/sqlFunction");

describe("Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loginUser", () => {
    test("should set cookie and return user payload on successful login", async () => {
      authServices.loginUserService.mockResolvedValueOnce({
        status: true,
        data: {
          role: "admin",
          email: "test@gmail.com",
          name: "Test User",
          token: "signed-token"
        },
        message: "You have logged in successfully"
      });

      const req = {
        body: {
          email: "test@gmail.com",
          password: "correct-password"
        }
      };
      const res = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      await authController.loginUser(req, res, next);

      expect(authServices.loginUserService).toHaveBeenCalledWith(req.body);
      expect(res.cookie).toHaveBeenCalledWith("token", "signed-token", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        status: true,
        user: {
          role: "admin",
          email: "test@gmail.com",
          name: "Test User"
        },
        message: "You have logged in successfully",
        token: "signed-token"
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should forward service errors to next middleware", async () => {
      authServices.loginUserService.mockResolvedValueOnce({
        status: false,
        message: "The password you entered is incorrect"
      });

      const req = {
        body: {
          email: "test@gmail.com",
          password: "wrong-password"
        }
      };
      const res = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      await authController.loginUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg.message).toBe("The password you entered is incorrect");
      expect(errorArg.statuscode).toBe(400);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  describe("logoutUser", () => {
    test("should clear auth cookie and return success response", async () => {
      process.env.NODE_ENV = "test";

      const req = {};
      const res = {
        clearCookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await authController.logoutUser(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith("token", {
        httpOnly: true,
        secure: false,
        sameSite: "strict"
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: "Logged out successfully"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("me", () => {
    test("should return the authenticated user from bearer token", async () => {
      process.env.JWT_SECRET = "test-secret";
      jwt.verify.mockReturnValueOnce({ id: 9 });
      sqlQueryFun.mockResolvedValueOnce([
        {
          id: 9,
          role: "admin",
          email: "test@gmail.com",
          name: "Test User"
        }
      ]);

      const req = {
        cookies: {},
        header: jest.fn().mockReturnValue("Bearer valid-token")
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await authController.me(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret");
      expect(sqlQueryFun).toHaveBeenCalledWith(
        "SELECT id, role, email, name FROM users WHERE id = $1",
        [9]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        data: {
          id: 9,
          role: "admin",
          email: "test@gmail.com",
          name: "Test User"
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should forward not authenticated error when token is missing", async () => {
      const req = {
        cookies: {},
        header: jest.fn().mockReturnValue(undefined)
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await authController.me(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      expect(errorArg.message).toBe("Not authenticated");
      expect(errorArg.statuscode).toBe(401);
      expect(sqlQueryFun).not.toHaveBeenCalled();
    });
  });
});
