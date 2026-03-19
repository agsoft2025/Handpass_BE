const express = require("express");
const routes = express();
const timeGroupController = require("../controllers/timeGroup.controller");
const { authenticate } = require("../middleware/auth");

routes.use(authenticate);
routes.post("/time_groups", timeGroupController.createTimeGroup);
routes.get("/time_groups", timeGroupController.getTimeGroups);
routes.put("/time_groups/:id", timeGroupController.updateTimeGroup);
routes.delete("/time_groups/delete", timeGroupController.softDeleteTimeGroup);

module.exports = routes;
