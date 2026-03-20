const express = require("express");
const routes = express();
const timeGroupController = require("../controllers/timeGroup.controller");
const { authenticate, authorizeRoles } = require("../middleware/auth");

routes.use(authenticate);
routes.post("/time_groups", authorizeRoles('admin', 'superadmin'), timeGroupController.createTimeGroup);
routes.get("/time_groups", timeGroupController.getTimeGroups);
routes.put("/time_groups/:id", authorizeRoles('admin', 'superadmin'), timeGroupController.updateTimeGroup);
routes.delete("/time_groups/delete", authorizeRoles('admin', 'superadmin'), timeGroupController.softDeleteTimeGroup);

module.exports = routes;
