const express = require("express");
const routes = express();
const deviceGroupAssignmentController = require("../controllers/deviceGroupAssignment.controller");
const { authenticate } = require("../middleware/auth");

routes.use(authenticate);
routes.post("/device_group_assignments", deviceGroupAssignmentController.createDeviceGroupAssignment);
routes.get("/device_group_assignments", deviceGroupAssignmentController.getDeviceGroupAssignments);
routes.put("/device_group_assignments/:id", deviceGroupAssignmentController.updateDeviceGroupAssignment);
routes.delete("/device_group_assignments/delete", deviceGroupAssignmentController.softDeleteDeviceGroupAssignment);

module.exports = routes;
