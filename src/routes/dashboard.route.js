const express = require('express')
const routes = express()
const dashboardController = require("../controllers/dashboard.controller")
const { authenticate } = require('../middleware/auth')

routes.use(authenticate)
routes.get("/",dashboardController.fetchDashboard)

module.exports = routes