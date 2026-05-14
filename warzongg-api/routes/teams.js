const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  handleValidation,
  teamCreate,
  teamUpdate,
  transferCaptainMine: transferCaptainMineRules,
  teamInviteCreate,
  teamSavedRosterCreate,
  teamSavedRosterUpdate,
  rosterIdUuidParam,
  rejectUnknownBodyFields,
  inviteIdUuidParam,
  joinRequestIdUuidParam,
} = require('../middleware/validate');
const {
  create,
  getById,
  update,
  getMyTeam,
  transferCaptainMine,
  getMyTeamNotifications,
  markMyTeamNotificationsRead
} = require('../controllers/teamsController');
const {
  createInviteMine,
  listOutgoingInvitesMine,
  cancelInviteMine,
} = require('../controllers/teamInvitesController');
const {
  listCaptainIncomingJoinRequests,
  captainAcceptJoinRequest,
  captainDeclineJoinRequest,
} = require('../controllers/joinRequestsController');
const {
  listMine: listTeamSavedRosters,
  createMine: createTeamSavedRoster,
  updateMine: updateTeamSavedRoster,
  deleteMine: deleteTeamSavedRoster
} = require('../controllers/teamSavedRostersController');

// POST /api/teams — authenticated, captain registers a team
router.post('/', requireAuth, teamCreate, handleValidation, create);

// GET /api/teams/mine — authenticated, must be BEFORE /:id or Express matches 'mine' as an id
router.get('/mine', requireAuth, getMyTeam);
router.post('/mine/transfer-captain', requireAuth, transferCaptainMineRules, handleValidation, transferCaptainMine);
router.post('/mine/invites', requireAuth, teamInviteCreate, handleValidation, createInviteMine);
router.get('/mine/invites/outgoing', requireAuth, listOutgoingInvitesMine);
router.delete('/mine/invites/:inviteId', requireAuth, inviteIdUuidParam, handleValidation, cancelInviteMine);
router.get('/mine/join-requests/incoming', requireAuth, listCaptainIncomingJoinRequests);
router.post('/mine/join-requests/:joinRequestId/accept', requireAuth, joinRequestIdUuidParam, handleValidation, captainAcceptJoinRequest);
router.post('/mine/join-requests/:joinRequestId/decline', requireAuth, joinRequestIdUuidParam, handleValidation, captainDeclineJoinRequest);
router.get('/mine/saved-rosters', requireAuth, listTeamSavedRosters);
router.post(
  '/mine/saved-rosters',
  requireAuth,
  rejectUnknownBodyFields(['name', 'lineup']),
  teamSavedRosterCreate,
  handleValidation,
  createTeamSavedRoster
);
router.patch(
  '/mine/saved-rosters/:rosterId',
  requireAuth,
  rosterIdUuidParam,
  rejectUnknownBodyFields(['name', 'lineup']),
  teamSavedRosterUpdate,
  handleValidation,
  updateTeamSavedRoster
);
router.delete('/mine/saved-rosters/:rosterId', requireAuth, rosterIdUuidParam, handleValidation, deleteTeamSavedRoster);
router.get('/mine/notifications', requireAuth, getMyTeamNotifications);
router.patch('/mine/notifications/read', requireAuth, markMyTeamNotificationsRead);

// GET /api/teams/:id — public, team profile with roster
router.get('/:id', getById);

// PATCH /api/teams/:id — authenticated, captain updates team
router.patch('/:id', requireAuth, teamUpdate, handleValidation, update);

module.exports = router;