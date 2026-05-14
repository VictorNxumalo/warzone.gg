const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateRegistrationPost, registrationStatusPatch, handleValidation } = require('../middleware/validate');
const { getAll, updateStatus } = require('../controllers/registrationsController');
const { create } = require('../controllers/teamsController');

// POST /api/registrations — new squad OR { register_existing_team: true, tournament_id } for captains
router.post('/', requireAuth, validateRegistrationPost, create);

router.get('/', requireAdmin, getAll);
router.patch('/:id/status', requireAdmin, registrationStatusPatch, handleValidation, updateStatus);

module.exports = router;