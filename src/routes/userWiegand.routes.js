const express = require('express')
const routes = express()
const userWiegandController = require("../controllers/userWiegand.controller")
const { authenticate } = require('../middleware/auth')

routes.use(authenticate)
routes.post("/user_wiegands",userWiegandController.addUserWiegand)
routes.get("/user_wiegands",userWiegandController.getUserWiegand)
routes.delete("/user_wiegands/:id",userWiegandController.softDeleteUserWiegand)
routes.put("/user_wiegands/:id",userWiegandController.updateUserWiegand)

module.exports = routes