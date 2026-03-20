const express = require('express')
const routes = express()
const userWiegandController = require("../controllers/userWiegand.controller")
const { authenticate, authorizeRoles } = require('../middleware/auth')

routes.use(authenticate)
routes.post("/user_wiegands", authorizeRoles('admin', 'superadmin'), userWiegandController.addUserWiegand)
routes.get("/user_wiegands",userWiegandController.getUserWiegand)
routes.delete("/user_wiegands/:id", authorizeRoles('admin', 'superadmin'), userWiegandController.softDeleteUserWiegand)
routes.put("/user_wiegands/:id", authorizeRoles('admin', 'superadmin'), userWiegandController.updateUserWiegand)

module.exports = routes