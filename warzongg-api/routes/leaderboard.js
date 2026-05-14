const express = require('express');
const router = express.Router();
const { getLeaderboard } = require('../controllers/leaderboardController');

// GET /api/leaderboard — public
router.get('/', getLeaderboard);

module.exports = router;
