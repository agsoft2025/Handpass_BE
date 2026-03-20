const express = require('express')
const routes = express()
const wiegandGroupController = require("../controllers/wiegandGroup.controller")
const { authenticate, authorizeRoles } = require('../middleware/auth')

routes.use(authenticate)
routes.post("/wiegand_groups", authorizeRoles('admin', 'superadmin'), wiegandGroupController.createWiegandGroup)
routes.get("/wiegand_groups",wiegandGroupController.getWiegandGroups)
routes.put("/wiegand_groups/:id", authorizeRoles('admin', 'superadmin'), wiegandGroupController.updateWiegandGroup)
routes.delete("/wiegand_groups/delete", authorizeRoles('admin', 'superadmin'), wiegandGroupController.softDeleteWiegandGroup)

module.exports = routes