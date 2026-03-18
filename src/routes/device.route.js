const express = require("express");
const deviceController = require("../controllers/device.controller");
const usersControllerController = require("../controllers/user.controller");
const { authenticate } = require("../middleware/auth");


const router = express.Router();
// router.use(authenticate)
router.post("/device/updateStatus",deviceController.updateDeviceStatus)
router.post("/device/getAll", deviceController.fetchAllConnectDevices);
router.post("/device/getUsers", deviceController.deviceGetUsers);
router.post("/device/getPassRecords", deviceController.getPassRecordsByDeviceSn);
router.post("/connect",deviceController.connect)
router.post('/add', usersControllerController.addUserData);
router.post('/delete', deviceController.deleteUser);
router.post('/query', deviceController.queryUsers);
router.post('/check_registration', deviceController.checkRegistration);
router.post('/query_images', deviceController.queryUserImages);
router.post('/firmware_upgrade', deviceController.firmwareUpgrade);
router.post('/pass_list', deviceController.passList);
router.post('/query_batch_import_path', deviceController.queryBatchImportPath);

// group management
router.post('/query_wiegand_group', deviceController.queryWiegandGroup);
router.post('/query_user_wiegand', deviceController.queryUserWiegand);



router.post("/connect", deviceController.connectDeviceController);
// router.post("/add", deviceController.addUserToDeviceController);
router.put('/connect/:id',deviceController.updateDevice)
router.get('/connect/:id',deviceController.fetchSingleDevice)
router.delete('/connect/:id',deviceController.deleteDevice)

module.exports = router;
