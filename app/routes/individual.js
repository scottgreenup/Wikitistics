
const express = require('express');
const controller = require('../controllers/individual')

const router = express.Router();

router.get('/', controller.showPage);
router.get('/updateArticle', controller.updateArticle);
router.get('/articleList', controller.articleList);
router.get('/revisionCount', controller.revisionCount);
router.get('/topFiveUsers', controller.topFiveUsers);
router.get('/byYearByUser', controller.byYearByUser);
router.get('/byUser', controller.byUser);
router.get('/byYearByTopFive', controller.byYearByTopFive);

module.exports = router;
