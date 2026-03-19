const express = require("express");
const routes = express();
const remoteGroupController = require("../controllers/remoteGroup.controller");
const { authenticate } = require("../middleware/auth");

routes.use(authenticate);
routes.post("/remote_groups", remoteGroupController.createRemoteGroup);
routes.get("/remote_groups", remoteGroupController.getRemoteGroups);
routes.put("/remote_groups/:id", remoteGroupController.updateRemoteGroup);
routes.delete("/remote_groups/delete", remoteGroupController.softDeleteRemoteGroup);

module.exports = routes;
