const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  handleValidation,
  inviteIdUuidParam,
  joinRequestIdUuidParam,
  teamJoinRequestCreate,
  rejectUnknownBodyFields,
} = require('../middleware/validate');
const {
  getMyProfile,
  getMyParticipations,
  leaveMyTeam,
  getLeaveEligibility,
} = require('../controllers/playersController');
const {
  getIncomingInvitesForPlayer,
  acceptInviteAsPlayer,
  declineInviteAsPlayer,
} = require('../controllers/teamInvitesController');
const {
  createPlayerJoinRequest,
  listMyJoinRequests,
  cancelMyJoinRequest,
} = require('../controllers/joinRequestsController');

router.get('/me/participations', requireAuth, getMyParticipations);
router.get('/me', requireAuth, getMyProfile);
router.get('/me/leave-eligibility', requireAuth, getLeaveEligibility);
router.post('/me/leave-team', requireAuth, leaveMyTeam);
router.get('/me/team-invites', requireAuth, getIncomingInvitesForPlayer);
router.post('/me/team-invites/:inviteId/accept', requireAuth, inviteIdUuidParam, handleValidation, acceptInviteAsPlayer);
router.post('/me/team-invites/:inviteId/decline', requireAuth, inviteIdUuidParam, handleValidation, declineInviteAsPlayer);

router.post(
  '/me/team-join-requests',
  requireAuth,
  rejectUnknownBodyFields(['team_id']),
  teamJoinRequestCreate,
  handleValidation,
  createPlayerJoinRequest
);
router.get('/me/team-join-requests', requireAuth, listMyJoinRequests);
router.delete('/me/team-join-requests/:joinRequestId', requireAuth, joinRequestIdUuidParam, handleValidation, cancelMyJoinRequest);

module.exports = router;
