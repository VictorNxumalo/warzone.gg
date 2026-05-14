const { body, param, validationResult } = require('express-validator');
const { isUUID } = require('validator');

function isActivatePlayerLookupBody(b) {
  if (!b || typeof b !== 'object') return false;
  if (b.lookup === true || b.lookup === 'true') return true;
  if (b.mode === 'lookup' || b.mode === 'check') return true;
  const email = String(b.email || '').trim();
  const user = String(b.username || '').trim();
  const pass = String(b.password || '');
  return email.length > 0 && user.length === 0 && pass.length === 0;
}

/** Standard JSON error response for validation failures */
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const first = result.array({ onlyFirstError: true })[0];
    return res.status(400).json({
      error: first.msg || 'Invalid input',
      field: first.path || first.param,
    });
  }
  next();
}

function rejectUnknownBodyFields(allowedFields = []) {
  const allowed = new Set(allowedFields);
  return function rejectUnknown(req, res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return next();
    const unknown = Object.keys(body).filter((k) => !allowed.has(k));
    if (unknown.length) {
      return res.status(400).json({
        error: 'Unknown fields are not allowed.',
        fields: unknown,
      });
    }
    return next();
  };
}

const uuidParam = param('id')
  .isUUID()
  .withMessage('Invalid id');

// ── Auth ───────────────────────────────────────────────────────────

const authRegister = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Username must be 3–32 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username may only contain letters, numbers, underscore and hyphen'),
  body('whatsapp').optional({ values: 'null' }).trim().isLength({ max: 40 }).withMessage('WhatsApp too long'),
];

const authLogin = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const authActivateCheck = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
];

/** POST /activate-player — lookup shapes OR full { email, username, password } */
const authActivatePlayer = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
  body('username')
    .if((_, { req }) => !isActivatePlayerLookupBody(req.body))
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Username must be 3–32 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username may only contain letters, numbers, underscore and hyphen'),
  body('password')
    .if((_, { req }) => !isActivatePlayerLookupBody(req.body))
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

// ── Teams ───────────────────────────────────────────────────────────

const teamCreate = [
  body('name').trim().notEmpty().isLength({ min: 1, max: 120 }).withMessage('Team name is required'),
  body('tag').trim().notEmpty().isLength({ min: 1, max: 4 }).withMessage('Tag must be 1–4 characters'),
  body('region').trim().notEmpty().isLength({ max: 64 }).withMessage('Region is required'),
  body('tournament_id').isUUID().withMessage('Invalid tournament_id'),
  body('game_mode').trim().notEmpty().withMessage('game_mode is required'),
  body('players').isArray({ min: 1, max: 6 }).withMessage('players must be an array with 1–6 entries'),
];

const teamUpdate = [
  uuidParam,
  body('name').optional().trim().isLength({ min: 1, max: 120 }),
  body('tag').optional().trim().isLength({ min: 1, max: 4 }),
  body('region').optional().trim().isLength({ max: 64 }),
  body('logo_url').optional({ values: 'null' }).trim().isLength({ max: 2048 }),
];

// ── Registrations (admin) ───────────────────────────────────────────

const registrationStatusPatch = [
  uuidParam,
  body('status').isIn(['approved', 'rejected']).withMessage('status must be approved or rejected'),
  body('notes').optional({ values: 'null' }).trim().isLength({ max: 2000 }),
];

/** Captain registers an existing team for a tournament (POST /api/registrations) */
const registrationExistingCreate = [
  body('tournament_id').isUUID().withMessage('Invalid tournament_id'),
  body('game_mode').optional({ values: 'null' }).trim().isLength({ max: 80 }),
  body('device_type').optional({ values: 'null' }).trim().isLength({ max: 40 }),
  body('saved_roster_id').optional({ values: 'null' }).isUUID().withMessage('Invalid saved_roster_id'),
];

function isExistingTeamRegistrationBody(req) {
  const v = req.body?.register_existing_team;
  return v === true || v === 'true';
}

async function validateRegistrationPost(req, res, next) {
  const rules = isExistingTeamRegistrationBody(req) ? registrationExistingCreate : teamCreate;
  await Promise.all(rules.map((rule) => rule.run(req)));
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const first = result.array({ onlyFirstError: true })[0];
    return res.status(400).json({
      error: first.msg || 'Invalid input',
      field: first.path || first.param,
    });
  }
  next();
}

// ── Matches (admin) ─────────────────────────────────────────────────

const ROUND_VALUES = ['group_stage', 'quarter_final', 'semi_final', 'grand_final'];
/** Must match Postgres `matches_status_check` (typically scheduled | live | completed) */
const STATUS_VALUES = ['scheduled', 'live', 'completed'];

const matchCreate = [
  body('tournament_id').isUUID().withMessage('Invalid tournament_id'),
  body('team_a_id').isUUID().withMessage('Invalid team_a_id'),
  body('team_b_id')
    .optional({ values: 'null' })
    .custom((v) => v == null || v === '' || isUUID(String(v)))
    .withMessage('Invalid team_b_id'),
  body('round').optional({ values: 'falsy' }).isIn(ROUND_VALUES).withMessage(`round must be one of: ${ROUND_VALUES.join(', ')}`),
  body('round_number').optional({ values: 'null' }).isInt({ min: 1, max: 64 }),
  body('match_order').optional({ values: 'null' }).isInt({ min: 1, max: 1024 }),
  body('bracket_type').optional({ values: 'falsy' }).isIn(['upper', 'lower', 'grand_finals', 'single', 'round_robin']),
  body('next_match_id').optional({ values: 'null' }).isUUID().withMessage('Invalid next_match_id'),
  body('next_match_slot').optional({ values: 'falsy' }).isIn(['team_a', 'team_b']),
  body('status').optional().isIn(STATUS_VALUES),
  // Admin creates upcoming matches with explicit null scores — must allow null/undefined
  body('score_a').optional({ values: 'null' }).isInt({ min: 0 }),
  body('score_b').optional({ values: 'null' }).isInt({ min: 0 }),
  body('map_name').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('game_mode').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('scheduled_at').optional({ values: 'falsy' }).trim(),
  body('series_id').optional({ values: 'null' }).isUUID().withMessage('Invalid series_id'),
  body('map_number').optional().isInt({ min: 1, max: 99 }),
  body('stats').optional().isObject().withMessage('stats must be an object'),
  body('cod_mode').optional({ values: 'null' }).isLength({ max: 64 }),
  body('create_series').optional().isObject(),
  body('fgc_set_id').optional({ values: 'null' }).isUUID().withMessage('Invalid fgc_set_id'),
  body('fgc_game_number').optional().isInt({ min: 1, max: 99 }),
  body('create_fgc_set').optional().isObject(),
  body('dispute_status').optional({ values: 'null' }).isIn(['open', 'resolved', 'rejected']),
  body('dispute_notes').optional({ values: 'null' }).trim().isLength({ max: 4000 }),
  body('dispute_proof_url').optional({ values: 'null' }).trim().isLength({ max: 2048 }),
  body('disputed_by_team_id').optional({ values: 'null' }).isUUID().withMessage('Invalid disputed_by_team_id'),
];

const matchUpdate = [
  uuidParam,
  body('round').optional({ values: 'falsy' }).isIn(ROUND_VALUES),
  body('round_number').optional({ values: 'null' }).isInt({ min: 1, max: 64 }),
  body('match_order').optional({ values: 'null' }).isInt({ min: 1, max: 1024 }),
  body('bracket_type').optional({ values: 'falsy' }).isIn(['upper', 'lower', 'grand_finals', 'single', 'round_robin']),
  body('next_match_id').optional({ values: 'null' }).isUUID().withMessage('Invalid next_match_id'),
  body('next_match_slot').optional({ values: 'falsy' }).isIn(['team_a', 'team_b']),
  body('status').optional().isIn(STATUS_VALUES),
  body('score_a').optional({ values: 'null' }).isInt({ min: 0 }),
  body('score_b').optional({ values: 'null' }).isInt({ min: 0 }),
  body('map_name').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('game_mode').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('scheduled_at').optional({ values: 'falsy' }).trim(),
  body('stats').optional().isObject(),
  body('cod_mode').optional({ values: 'null' }).isLength({ max: 64 }),
  body('dispute_action').optional({ values: 'falsy' }).isIn(['open', 'resolve', 'reject', 'clear']),
  body('dispute_notes').optional({ values: 'null' }).trim().isLength({ max: 4000 }),
  body('dispute_proof_url').optional({ values: 'null' }).trim().isLength({ max: 2048 }),
  body('disputed_by_team_id').optional({ values: 'null' }).isUUID().withMessage('Invalid disputed_by_team_id'),
  body('dispute_resolved_winner_id').optional({ values: 'null' }).isUUID().withMessage('Invalid dispute_resolved_winner_id'),
];

const matchSeriesCreate = [
  body('tournament_id').isUUID().withMessage('Invalid tournament_id'),
  body('team_a_id').isUUID().withMessage('Invalid team_a_id'),
  body('team_b_id').isUUID().withMessage('Invalid team_b_id'),
  body('best_of').optional().isIn([1, 3, 5, 7]),
  body('round').optional().isIn(ROUND_VALUES),
];

// ── Tournaments (admin) ─────────────────────────────────────────────

const tournamentCreate = [
  body('name').trim().notEmpty().isLength({ max: 200 }).withMessage('name is required'),
  body('tag').trim().notEmpty().isLength({ max: 32 }),
  body('mode').trim().notEmpty(),
  body('type').trim().notEmpty(),
  body('format').trim().notEmpty(),
  body('start_date').trim().notEmpty(),
  body('reg_deadline').trim().notEmpty(),
  body('max_slots').isInt({ min: 1 }).withMessage('max_slots must be a positive integer'),
  body('prize_total').isInt({ min: 0 }).withMessage('prize_total must be a non-negative integer'),
  body('region').optional({ values: 'null' }).trim(),
  body('entry_fee').optional().isInt({ min: 0 }),
  body('prize_1st').optional().isInt({ min: 0 }),
  body('prize_2nd').optional().isInt({ min: 0 }),
  body('prize_3rd').optional().isInt({ min: 0 }),
  body('prize_mvp').optional().isInt({ min: 0 }),
  body('description').optional({ values: 'null' }).trim(),
  body('game_rule_profile').optional().isObject().withMessage('game_rule_profile must be an object'),
];

/** PATCH body is partial — controller white-lists fields */
const tournamentUpdate = [uuidParam];

const transferCaptainMine = [
  body('new_captain_player_id').isUUID().withMessage('new_captain_player_id must be a UUID'),
];

const teamInviteCreate = [
  body('invitee_email').trim().notEmpty().isEmail().withMessage('Valid invitee_email is required'),
];

const teamJoinRequestCreate = [
  body('team_id').isUUID().withMessage('team_id must be a valid UUID'),
];

const teamSavedRosterCreate = [
  body('name').trim().notEmpty().isLength({ min: 1, max: 120 }).withMessage('name is required'),
  body('lineup').isArray({ min: 1, max: 6 }).withMessage('lineup must be an array with 1-6 player ids'),
];

const teamSavedRosterUpdate = [
  body('name').optional().trim().isLength({ min: 1, max: 120 }).withMessage('name cannot be empty'),
  body('lineup').optional().isArray({ min: 1, max: 6 }).withMessage('lineup must be an array with 1-6 player ids'),
];

const adminAnnouncementCreate = [
  body('title').trim().notEmpty().isLength({ min: 3, max: 180 }).withMessage('title is required (3-180 chars)'),
  body('body').trim().notEmpty().isLength({ min: 3, max: 4000 }).withMessage('body is required (3-4000 chars)'),
  body('type').optional({ values: 'null' }).isIn(['info', 'live', 'update', 'warning']),
  body('tournament_id').optional({ values: 'null' }).isUUID().withMessage('Invalid tournament_id'),
];

const rosterIdUuidParam = param('rosterId').isUUID().withMessage('Invalid roster id');
const inviteIdUuidParam = param('inviteId').isUUID().withMessage('Invalid invite id');
const joinRequestIdUuidParam = param('joinRequestId').isUUID().withMessage('Invalid join request id');

module.exports = {
  handleValidation,
  rejectUnknownBodyFields,
  authRegister,
  authLogin,
  authActivateCheck,
  authActivatePlayer,
  teamCreate,
  teamUpdate,
  registrationStatusPatch,
  registrationExistingCreate,
  validateRegistrationPost,
  matchCreate,
  matchUpdate,
  matchSeriesCreate,
  tournamentCreate,
  tournamentUpdate,
  transferCaptainMine,
  teamInviteCreate,
  teamJoinRequestCreate,
  teamSavedRosterCreate,
  teamSavedRosterUpdate,
  adminAnnouncementCreate,
  rosterIdUuidParam,
  inviteIdUuidParam,
  joinRequestIdUuidParam,
};
