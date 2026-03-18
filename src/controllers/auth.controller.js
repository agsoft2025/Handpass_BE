const authServices = require("../services/auth.services")
const catchAsync = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const { sqlQueryFun } = require("../database/sql/sqlFunction");

const getTokenFromRequest = (req) => {
    const authHeader = req.header("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    return req.cookies?.token || bearerToken || null;
};

exports.RegisterUser = catchAsync(async (req, res, next) => {
    const { status, data, message } = await authServices.registerUserService(req.body)
    if (!status) return next(new ErrorHandler(message, 400));
    return res.status(200).send({ status, data, message })
})

exports.loginUser = catchAsync(async (req, res, next) => {
    const { status, data, message } = await authServices.loginUserService(req.body)
    if (!status) return next(new ErrorHandler(message, 400));
    const { role, email, name, token } = data
    const user = { role, email, name }

    // 🔥 Set secure HTTP-only cookie
    // res.cookie("token", token, {
    //     httpOnly: true,
    //     secure: false,     // MUST be false on localhost
    //     // sameSite: "lax",   // 👈 change this
    //     sameSite: "lax",   // 👈 change this
    //     maxAge: 30 * 24 * 60 * 60 * 1000
    // });
    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    });


    return res.status(200).send({ status, user, message,token })
})

exports.logoutUser = catchAsync(async (req, res, next) => {

    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    });

    return res.status(200).json({
        status: true,
        message: "Logged out successfully"
    });

});

exports.me = catchAsync(async (req, res, next) => {

    const token = getTokenFromRequest(req);
    if (!token) {
        return next(new ErrorHandler("Not authenticated", 401));
    }

    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return next(new ErrorHandler("Invalid or expired token", 401));
    }

    const userQuery = `SELECT id, role, email, name FROM users WHERE id = $1`;
    const user = await sqlQueryFun(userQuery, [decoded.id]);

    if (!user.length) {
        return next(new ErrorHandler("User not found", 404));
    }

    return res.status(200).json({
        status: true,
        data: user[0]
    });

});


