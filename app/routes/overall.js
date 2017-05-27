
const express = require('express');
const controller = require('../controllers/overall')

const router = express.Router();

router.get('/', controller.showPage);

module.exports = router;
