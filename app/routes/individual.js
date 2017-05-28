
const express = require('express');
const controller = require('../controllers/individual')

const router = express.Router();

router.get('/', controller.showPage);
router.get('/articleList', controller.articleList);
router.get('/revisionCount', controller.revisionCount);
router.get('/topFiveUsers', controller.topFiveUsers);

module.exports = router;
