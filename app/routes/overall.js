
const express = require('express');
const controller = require('../controllers/overall')

const router = express.Router();

router.get('/', controller.showPage);
router.get('/mostrevisions', controller.mostRevisions);
router.get('/leastrevisions', controller.leastRevisions);
router.get('/mostUsers', controller.mostUsers);
router.get('/leastUsers', controller.leastUsers);
router.get('/oldest', controller.oldestTimestamp);
router.get('/youngest', controller.youngestTimestamp);

router.get('/byYearByUser', controller.byYearByUser);

module.exports = router;
