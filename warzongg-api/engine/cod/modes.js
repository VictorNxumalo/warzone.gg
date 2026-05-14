/**
 * Call of Duty — canonical mode keys used by the resolution engine.
 * `game_mode` from the admin UI is normalized via normalizeCodMode().
 */
const COD_MODES = {
  SEARCH_DESTROY: 'search_destroy',
  HARDPOINT: 'hardpoint',
  DOMINATION: 'domination',
  TDM: 'team_deathmatch',
  FFA: 'free_for_all',
  DUEL_1V1: 'duel_1v1',
  BATTLE_ROYALE: 'battle_royale',
  /** Legacy / simple: winner from primary score columns only */
  SCORE_ONLY: 'score_only',
};

/**
 * Map common UI strings (COD / Warzone / CDL-style labels) to COD_MODES.
 */
function normalizeCodMode(gameMode) {
  const raw = String(gameMode || '').trim().toLowerCase();
  if (!raw) return COD_MODES.SCORE_ONLY;

  if (/search|destroy|\bs\s*&\s*d\b|\bsnd\b/.test(raw)) return COD_MODES.SEARCH_DESTROY;
  if (/hard\s*bhp\b/.test(raw)) return COD_MODES.HARDPOINT;
  if (/domination|\bdom\b/.test(raw)) return COD_MODES.DOMINATION;
  if (/death\s*match|\btdm\b|team\s*dm/.test(raw)) return COD_MODES.TDM;
  if (/free\s*for\s*all|\bffa\b/.test(raw)) return COD_MODES.FFA;
  if (/1\s*v\s*1|duel|solo/.test(raw)) return COD_MODES.DUEL_1V1;
  if (/battle\s*royale|warzone|\bbr\b|resurgence/.test(raw)) return COD_MODES.BATTLE_ROYALE;

  return COD_MODES.SCORE_ONLY;
}

module.exports = { COD_MODES, normalizeCodMode };
