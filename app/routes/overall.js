
const express = require('express');
const controller = require('../controllers/overall')

const router = express.Router();

router.get('/', controller.showPage);
router.get('/mostrevisions', controller.mostRevisions);

module.exports = router;
