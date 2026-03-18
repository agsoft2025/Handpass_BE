const express = require('express')
const routes = express()
const attendanceController = require('../controllers/attendanceSettings.controller');

routes.post("/",attendanceController.fetchAttendance);

module.exports = routes