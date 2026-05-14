const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { adminAnnouncementCreate, handleValidation, rejectUnknownBodyFields } = require('../middleware/validate');
const { getDashboard, getTeams, createAnnouncement, getAnnouncements } = require('../controllers/adminController');

// GET /api/admin/dashboard
router.get('/dashboard', requireAdmin, getDashboard);

// GET /api/admin/teams
router.get('/teams', requireAdmin, getTeams);

// POST /api/admin/announcements
router.post(
  '/announcements',
  requireAdmin,
  rejectUnknownBodyFields(['title', 'body', 'type', 'tournament_id']),
  adminAnnouncementCreate,
  handleValidation,
  createAnnouncement
);

// GET /api/admin/announcements
router.get('/announcements', requireAdmin, getAnnouncements);

module.exports = router;
