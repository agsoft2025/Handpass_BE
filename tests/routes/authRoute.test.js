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
const request = require("supertest");
const app = require("../../src/app");
const jwt = require("jsonwebtoken");
const { sqlQueryFun } = require("../../src/database/sql/sqlFunction");
const {
  registerUserService,
  loginUserService
} = require("../../src/services/auth.services");

describe("Auth Api",()=>{
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should register user",async()=>{
        registerUserService.mockResolvedValue({
            status:true,
            data:{id:1,name:"test"},
            message:"User registration completed successfully"
        })
        const res = await request(app)
        .post("/api/auth")
        .send({
            name:"test",
            email:"test@gmail.com",
            password:"correct",
            role:"admin"
        })
        expect(res.status).toBe(200)
        expect(res.body.status).toBe(true)
    })

    test("should login user and set auth cookie",async()=>{
        loginUserService.mockResolvedValue({
            status:true,
            data:{
                role:"admin",
                email:"test@gmail.com",
                name:"Test User",
                token:"signed-token"
            },
            message:"You have logged in successfully"
        })
        const res = await request(app)
        .post("/api/auth/login")
        .send({
            email:"test@gmail.com",
            password:"correct"
        })
        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            status:true,
            user:{
                role:"admin",
                email:"test@gmail.com",
                name:"Test User"
            },
            message:"You have logged in successfully",
            token:"signed-token"
        })
        expect(res.headers["set-cookie"]).toEqual(
            expect.arrayContaining([
                expect.stringContaining("token=signed-token"),
                expect.stringContaining("HttpOnly"),
                expect.stringContaining("Secure"),
                expect.stringContaining("SameSite=None")
            ])
        )
    })

    test("should logout user and clear auth cookie", async () => {
        const res = await request(app)
        .get("/api/auth/logout");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: true,
            message: "Logged out successfully"
        });
        expect(res.headers["set-cookie"]).toEqual(
            expect.arrayContaining([
                expect.stringContaining("token="),
                expect.stringContaining("HttpOnly"),
                expect.stringContaining("SameSite=Strict")
            ])
        );
    })

    test("should return authenticated user for /api/auth/me", async () => {
        process.env.JWT_SECRET = "test-secret";
        jwt.verify.mockReturnValue({
            id: 11
        });
        sqlQueryFun.mockResolvedValue([
            {
                id: 11,
                role: "admin",
                email: "me@gmail.com",
                name: "Me User"
            }
        ]);

        const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer valid-token");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: true,
            data: {
                id: 11,
                role: "admin",
                email: "me@gmail.com",
                name: "Me User"
            }
        });
        expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret");
        expect(sqlQueryFun).toHaveBeenCalledWith(
            "SELECT id, role, email, name FROM users WHERE id = $1",
            [11]
        );
    })
})

afterAll(() => {
  jest.clearAllMocks();
});
