const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { listTeamsRecruiting, listFreeAgents } = require('../controllers/discoveryController');

router.get('/teams-recruiting', requireAuth, listTeamsRecruiting);
router.get('/free-agents', requireAuth, listFreeAgents);

module.exports = router;
