const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { handleValidation, matchCreate, matchUpdate } = require('../middleware/validate');
const { getAll, getById, getBracketView, getIncrementalUpdates, create, update } = require('../controllers/matchesController');

// GET /api/matches — public
router.get('/', getAll);

// GET /api/matches/updates?since=... — public incremental updates
router.get('/updates', getIncrementalUpdates);

// GET /api/matches/bracket/:tournamentId — public grouped bracket view
router.get('/bracket/:tournamentId', getBracketView);

// GET /api/matches/:id — public
router.get('/:id', getById);

// POST /api/matches — admin only
router.post('/', requireAdmin, matchCreate, handleValidation, create);

// PATCH /api/matches/:id — admin only
router.patch('/:id', requireAdmin, matchUpdate, handleValidation, update);

module.exports = router;
