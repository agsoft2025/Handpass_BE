const express = require("express");
const routes = express();
const deviceGroupAssignmentController = require("../controllers/deviceGroupAssignment.controller");
const { authenticate, authorizeRoles } = require("../middleware/auth");

routes.use(authenticate);
routes.post("/device_group_assignments", authorizeRoles('admin', 'superadmin'), deviceGroupAssignmentController.createDeviceGroupAssignment);
routes.get("/device_group_assignments", deviceGroupAssignmentController.getDeviceGroupAssignments);
routes.put("/device_group_assignments/:id", authorizeRoles('admin', 'superadmin'), deviceGroupAssignmentController.updateDeviceGroupAssignment);
routes.delete("/device_group_assignments/delete", authorizeRoles('admin', 'superadmin'), deviceGroupAssignmentController.softDeleteDeviceGroupAssignment);

module.exports = routes;
