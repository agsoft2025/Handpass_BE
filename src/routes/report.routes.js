const express = require('express')
const routes = express()
const reportRoutes = require("../controllers/report.controller")
const { authenticate } = require('../middleware/auth')

routes.use(authenticate)
routes.post("/access-list",reportRoutes.deviceAccessReport)
routes.post("/access-list/:id",reportRoutes.fetchUsersByGroup)
module.exports = routes
