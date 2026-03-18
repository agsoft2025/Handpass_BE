const express = require('express');
const router = express.Router();
const holidayCtrl = require('../controllers/holiday.controller');
const { authenticate } = require('../middleware/auth');

// Admin only (add auth middleware later)
router.use(authenticate)
router.post('/', holidayCtrl.addHoliday);
router.post('/bulk', holidayCtrl.addBulkHolidays);
router.get('/', holidayCtrl.getAllHolidays);
router.get('/:id', holidayCtrl.getHolidayById);
router.put('/:id', holidayCtrl.updateHoliday);
router.delete('/:id', holidayCtrl.deleteHoliday);

module.exports = router;
