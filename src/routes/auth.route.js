const express = require('express')
const routes = express()
const authController = require('../controllers/auth.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

routes.post("/", authenticate, authorizeRoles('admin', 'superadmin'), authController.RegisterUser);
routes.post("/login",authController.loginUser)
routes.get("/logout",authController.logoutUser)
routes.get("/me",authController.me)

module.exports = routes