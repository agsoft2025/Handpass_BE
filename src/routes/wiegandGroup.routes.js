const express = require('express')
const routes = express()
const wiegandGroupController = require("../controllers/wiegandGroup.controller")
const { authenticate } = require('../middleware/auth')

routes.use(authenticate)
routes.post("/wiegand_groups",wiegandGroupController.createWiegandGroup)
routes.get("/wiegand_groups",wiegandGroupController.getWiegandGroups)
routes.put("/wiegand_groups/:id",wiegandGroupController.updateWiegandGroup)
routes.delete("/wiegand_groups/delete",wiegandGroupController.softDeleteWiegandGroup)

module.exports = routes