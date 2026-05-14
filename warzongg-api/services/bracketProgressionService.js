const { supabaseAdmin } = require('../config/supabase');

const SLOT_TO_TEAM_FIELD = {
  team_a: 'team_a_id',
  team_b: 'team_b_id',
};

async function clearAdvancedWinner(nextMatchId, slot, winnerId) {
  if (!nextMatchId || !slot || !winnerId) return;
  const teamField = SLOT_TO_TEAM_FIELD[slot];
  if (!teamField) return;

  const { data: nextMatch, error } = await supabaseAdmin
    .from('matches')
    .select(`id, ${teamField}`)
    .eq('id', nextMatchId)
    .single();

  if (error || !nextMatch) return;
  if (String(nextMatch[teamField] || '') !== String(winnerId)) return;

  await supabaseAdmin
    .from('matches')
    .update({ [teamField]: null })
    .eq('id', nextMatchId);
}

async function placeWinnerIntoNextMatch(nextMatchId, slot, winnerId) {
  if (!nextMatchId || !slot || !winnerId) return;
  const teamField = SLOT_TO_TEAM_FIELD[slot];
  if (!teamField) {
    throw new Error('Invalid next_match_slot. Use team_a or team_b.');
  }

  const { data: nextMatch, error } = await supabaseAdmin
    .from('matches')
    .select(`id, ${teamField}`)
    .eq('id', nextMatchId)
    .single();

  if (error) throw error;
  if (!nextMatch) throw new Error('next_match_id does not exist.');

  const existingTeam = nextMatch[teamField];
  if (existingTeam && String(existingTeam) !== String(winnerId)) {
    throw new Error(`Next match slot ${slot} is already occupied by another team.`);
  }

  await supabaseAdmin
    .from('matches')
    .update({ [teamField]: winnerId })
    .eq('id', nextMatchId);
}

async function syncWinnerProgression({ beforeMatch, afterMatch }) {
  const beforeCompleted = beforeMatch?.status === 'completed' && beforeMatch?.winner_id;
  const afterCompleted = afterMatch?.status === 'completed' && afterMatch?.winner_id;

  if (beforeCompleted) {
    const winnerChanged = !afterCompleted || String(beforeMatch.winner_id) !== String(afterMatch.winner_id);
    const targetChanged = !afterMatch
      || String(beforeMatch.next_match_id || '') !== String(afterMatch.next_match_id || '')
      || String(beforeMatch.next_match_slot || '') !== String(afterMatch.next_match_slot || '');

    if (winnerChanged || targetChanged) {
      await clearAdvancedWinner(
        beforeMatch.next_match_id,
        beforeMatch.next_match_slot,
        beforeMatch.winner_id
      );
    }
  }

  if (afterCompleted) {
    await placeWinnerIntoNextMatch(
      afterMatch.next_match_id,
      afterMatch.next_match_slot,
      afterMatch.winner_id
    );
  }
}

module.exports = {
  syncWinnerProgression,
};
