const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const errorMiddleare = require('./middleware/error')
const path = require('path')
const morgan = require('morgan');
const app = express()

app.use('/uploads', express.static(path.join(__dirname,'..', 'uploads')));
// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
//routes
const indexRoutes = require('./routes/index')
const authRoutes = require("./routes/auth.route")
const fileUploadRoutes = require('./routes/fileUpload.route')
const connectDeviceRoutes = require("./routes/device.route");
const groupRoutes = require("./routes/group.route");
const usersRoutes = require("./routes/user.routes");
const accessRoutes = require("./routes/report.routes");
const dashboardRoutes = require("./routes/dashboard.route");
const holidayRoutes = require("./routes/holiday.route");
const shiftRoutes = require("./routes/shift.route");
const userWiegandRoutes = require("./routes/userWiegand.routes")
const WiegandGroupRoutes = require("./routes/wiegandGroup.routes")
const attendanceRoutes = require('./routes/attendance.route');
const { pool } = require('./config/database')
// const { restartDatabase } = require('./crone/deviceOfflineCron');
require('./crone/attendanceReminder');

app.use(express.json({ limit: "200mb" }));  
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());
// const allowedOrigins = [
//   "http://localhost:3000",
//   "http://localhost:5173"
// ];
// app.use(
//   cors({
//     origin:allowedOrigins,
//     credentials: true,
//   })
// );
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://localhost:5173",
  "https://yourdomain.com",
  "https://www.yourdomain.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow Postman / mobile apps

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);


app.use("/", indexRoutes);
app.use("/api/auth", authRoutes)
app.use("/v1",connectDeviceRoutes)
app.use("/v1/api",userWiegandRoutes)
app.use("/v1/api",WiegandGroupRoutes)
app.use("/v1/attendance",attendanceRoutes)
app.use("/api/attendance",attendanceRoutes)
app.use("/api/upload",fileUploadRoutes)
app.use("/api/group",groupRoutes)
app.use("/api/users",usersRoutes)
app.use("/api/report",accessRoutes)
app.use("/api/dashboard",dashboardRoutes)
app.use("/api/holiday",holidayRoutes)
app.use("/api/shift",shiftRoutes)

// restartDatabase()


app.use((err, req, res, next) => {
  console.error("🔥 ERROR CAUGHT BY MIDDLEWARE 🔥");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("REQ BODY:", req.body);
  return res.status(500).json({
    code: 500,
    msg: "Internal Server Error",
    error: err.message,
  });
});
//error middleware
app.use(errorMiddleare);

module.exports = app
