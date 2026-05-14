const express = require('express');
const router = express.Router();
const { getSchedule } = require('../controllers/leaderboardController');

// GET /api/schedule — public
router.get('/', getSchedule);

module.exports = router;
