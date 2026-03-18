const express = require('express')
const routes = express()
const shiftController = require("../controllers/shift.controller")
const { authenticate } = require('../middleware/auth')

routes.use(authenticate)
routes.post("/",shiftController.createShift)
routes.get("/",shiftController.getShift)
routes.put("/:id",shiftController.updateShift)

module.exports = routes