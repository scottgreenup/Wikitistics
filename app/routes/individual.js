
const express = require('express');
const controller = require('../controllers/individual')

const router = express.Router();

router.get('/', controller.showPage);

module.exports = router;
