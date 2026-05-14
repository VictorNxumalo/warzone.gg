const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { handleValidation, tournamentCreate, tournamentUpdate } = require('../middleware/validate');
const { getAll, getById, getApprovedTeams, create, update, remove } = require('../controllers/tournamentsController');

// GET /api/tournaments — public, supports ?status= and ?type= filters
router.get('/', getAll);

// GET /api/tournaments/:id/approved-teams — public (must be before /:id bare)
router.get('/:id/approved-teams', getApprovedTeams);

// GET /api/tournaments/:id — public, single tournament detail
router.get('/:id', getById);

// POST /api/tournaments — admin only
router.post('/', requireAdmin, tournamentCreate, handleValidation, create);

// PATCH /api/tournaments/:id — admin only
router.patch('/:id', requireAdmin, tournamentUpdate, handleValidation, update);

// DELETE /api/tournaments/:id — admin only
router.delete('/:id', requireAdmin, remove);

module.exports = router;
