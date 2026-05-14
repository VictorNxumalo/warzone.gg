const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { handleValidation, matchSeriesCreate } = require('../middleware/validate');
const { create } = require('../controllers/matchSeriesController');

router.post('/', requireAdmin, matchSeriesCreate, handleValidation, create);

module.exports = router;
