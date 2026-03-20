const express = require('express')
const routes = express()
const usersController = require('../controllers/user.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

routes.use(authenticate)
routes.get("/",usersController.fetchAllUsers)
routes.get("/profile", usersController.getUserProfile)
routes.put("/profile", usersController.updateUserProfile)
routes.get("/with-group",usersController.fetchAllUsersWithGroup)
routes.delete("/:id", authorizeRoles('admin', 'superadmin'), usersController.deleteUsersWithGroup)
routes.delete("/with-group/:id", authorizeRoles('admin', 'superadmin'), usersController.deleteUsersWithGroup)
routes.get("/with-group/:id",usersController.fetchSingleUsersWithGroup)
routes.put("/update-permission/:id", authorizeRoles('admin', 'superadmin'), usersController.updateUsersPersmissions)
routes.put("/update-user/:id", authorizeRoles('admin', 'superadmin'), usersController.updateUsersDetails)

module.exports = routes
