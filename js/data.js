// EVOLVE — Shared Data Store
// const WZ = {
//   tournaments: [
//     {
//       id: 1, name: "Operation Warfront — Grand Finals", tag: "OWF", mode: "Ranked 5v5",
//       type: "ranked", status: "live", date: "2025-05-18", prize: 50000, entryFee: 150,
//       slots: 16, registered: 16, region: "ZA", format: "Hardpoint + S&D",
//       description: "The premier 5v5 ranked tournament for elite South African CODM teams. Double elimination bracket, Bo3 matches, Bo5 Grand Final.",
//       prizeBreakdown: { first: 28000, second: 14000, third: 6000, mvp: 2000 }
//     },
//     {
//       id: 2, name: "Midnight Assault — Season Open", tag: "MAS", mode: "Squad BR",
//       type: "br", status: "open", date: "2025-06-01", prize: 20000, entryFee: 150,
//       slots: 16, registered: 10, region: "ZA", format: "Battle Royale",
//       description: "Open registration squad BR tournament. Top kills + placement scoring system. 3 match rounds, aggregate scoring.",
//       prizeBreakdown: { first: 12000, second: 5000, third: 2000, mvp: 1000 }
//     },
//     {
//       id: 3, name: "Iron Sights — Weekly Duos", tag: "ISD", mode: "Duos",
//       type: "duos", status: "open", date: "2025-05-25", prize: 8000, entryFee: 100,
//       slots: 16, registered: 4, region: "ZA", format: "Multiplayer",
//       description: "Weekly duos tournament. Fast-paced multiplayer format — Hardpoint and Domination.",
//       prizeBreakdown: { first: 5000, second: 2000, third: 800, mvp: 200 }
//     },gg
//     {
//       id: 4, name: "Lone Wolf Championship", tag: "LWC", mode: "Solo BR",
//       type: "solo", status: "upcoming", date: "2025-06-14", prize: 15000, entryFee: 80,
//       slots: 32, registered: 2, region: "ZA", format: "BR Solo",
//       description: "Individual BR championship. Highest placement + kill points over 4 rounds.",
//       prizeBreakdown: { first: 8000, second: 4000, third: 2000, mvp: 1000 }
//     },
//     {
//       id: 5, name: "Season 1 — Grand Slam", tag: "S1G", mode: "Squad",
//       type: "ranked", status: "completed", date: "2025-04-20", prize: 40000, entryFee: 150,
//       slots: 16, registered: 16, region: "ZA", format: "Mixed",
//       winner: "GhostSquad ZA",
//       description: "The inaugural EVOLVE season tournament. Concluded successfully.",
//       prizeBreakdown: { first: 24000, second: 10000, third: 4000, mvp: 2000 }
//     },
//     {
//       id: 6, name: "Pro League Qualifier", tag: "PLQ", mode: "Ranked",
//       type: "ranked", status: "upcoming", date: "2025-07-05", prize: 35000, entryFee: 200,
//       slots: 8, registered: 1, region: "ZA", format: "5v5 Ranked",
//       description: "Qualifier for the national CODM Pro League. Top 2 teams earn a spot.",
//       prizeBreakdown: { first: 20000, second: 10000, third: 4000, mvp: 1000 }
//     }
//   ],

//   teams: [
//     { id: 1, name: "GhostSquad ZA", tag: "GSZ", region: "Gauteng", wins: 14, losses: 2, kd: 2.41, points: 1840, earnings: 28500, status: "approved", players: ["GhostX","Specter","VortexSA","BlackKite","NightZero"], sub: "PhantomSA", tournament: 1 },
//     { id: 2, name: "TacticalFive", tag: "TF5", region: "Western Cape", wins: 12, losses: 4, kd: 2.08, points: 1620, earnings: 18000, status: "approved", players: ["TactX","Sniper1","Rusher","SmokeGG","Reload"], sub: null, tournament: 1 },
//     { id: 3, name: "BloodHound", tag: "BLH", region: "Gauteng", wins: 10, losses: 4, kd: 1.95, points: 1380, earnings: 12500, status: "approved", players: ["Bloodshot","HoundDog","FangZA","TrackerX","Alpha1"], sub: "Backup1", tournament: 1 },
//     { id: 4, name: "ZeroRecoil", tag: "ZR0", region: "KwaZulu-Natal", wins: 9, losses: 5, kd: 1.72, points: 1190, earnings: 9000, status: "approved", players: ["ZeroX","CalmGun","Steady1","PrecisionZA","NoMiss"], sub: null, tournament: 1 },
//     { id: 5, name: "RedEye Ops", tag: "REO", region: "Gauteng", wins: 8, losses: 6, kd: 1.60, points: 1050, earnings: 7000, status: "approved", players: ["RedX","EyeShot","TargetZA","Laser1","Scope"], sub: "Reserve1", tournament: 1 },
//     { id: 6, name: "NightStrike", tag: "NSK", region: "Western Cape", wins: 7, losses: 7, kd: 1.44, points: 920, earnings: 5500, status: "approved", players: ["NightX","StrikeOne","Shadow","Phantom2","DarkOps"], sub: null, tournament: 1 },
//     { id: 7, name: "ShadowWolves", tag: "SWO", region: "Gauteng", wins: 0, losses: 0, kd: 0, points: 0, earnings: 0, status: "pending", players: ["WolfX","Shadow2","Pack1","Howl","Fangs"], sub: null, tournament: 2 },
//     { id: 8, name: "IronFist", tag: "IRF", region: "Mpumalanga", wins: 0, losses: 0, kd: 0, points: 0, earnings: 0, status: "pending", players: ["IronX","Fist1","Steel","Hammer","Anvil"], sub: null, tournament: 3 },
//     { id: 9, name: "DeadWeight", tag: "DWT", region: "Eastern Cape", wins: 0, losses: 0, kd: 0, points: 0, earnings: 0, status: "rejected", players: ["Dead1","Weight"], sub: null, tournament: 2 }
//   ],

//   matches: [
//     { id: 1, teamA: "GhostSquad ZA", teamB: "RedEye Ops", scoreA: 3, scoreB: 1, map: "Standoff", mode: "Hardpoint", round: "Quarter Final", tournament: "Operation Warfront", date: "2025-05-18", time: "12:00" },
//     { id: 2, teamA: "TacticalFive", teamB: "NightStrike", scoreA: 3, scoreB: 2, map: "Rust", mode: "S&D", round: "Quarter Final", tournament: "Operation Warfront", date: "2025-05-18", time: "12:00" },
//     { id: 3, teamA: "BloodHound", teamB: "SilentBullet", scoreA: 3, scoreB: 0, map: "Nuketown", mode: "Domination", round: "Quarter Final", tournament: "Operation Warfront", date: "2025-05-18", time: "13:00" },
//     { id: 4, teamA: "ZeroRecoil", teamB: "IronClaw", scoreA: 3, scoreB: 2, map: "Hijacked", mode: "Hardpoint", round: "Quarter Final", tournament: "Operation Warfront", date: "2025-05-18", time: "13:00" },
//     { id: 5, teamA: "GhostSquad ZA", teamB: "TacticalFive", scoreA: 3, scoreB: 2, map: "Standoff", mode: "Hardpoint", round: "Semi Final", tournament: "Operation Warfront", date: "2025-05-18", time: "14:00" },
//     { id: 6, teamA: "BloodHound", teamB: "ZeroRecoil", scoreA: null, scoreB: null, map: "TBD", mode: "TBD", round: "Semi Final", tournament: "Operation Warfront", date: "2025-05-18", time: "16:00", live: true },
//     { id: 7, teamA: "GhostSquad ZA", teamB: "TBD", scoreA: null, scoreB: null, map: "TBD", mode: "TBD", round: "Grand Final", tournament: "Operation Warfront", date: "2025-05-18", time: "18:30", pending: true }
//   ],

//   schedule: [
//     { date: "2025-05-18", label: "Saturday, May 18 · Live Day", matches: [
//       { time: "14:00 SAST", label: "SEMI FINAL 1", teamA: "GhostSquad ZA", teamB: "TacticalFive", tournament: "Operation Warfront", status: "live" },
//       { time: "16:00 SAST", label: "SEMI FINAL 2", teamA: "BloodHound", teamB: "ZeroRecoil", tournament: "Operation Warfront", status: "upcoming" },
//       { time: "18:30 SAST", label: "GRAND FINAL", teamA: "TBD", teamB: "TBD", tournament: "Operation Warfront", status: "pending" }
//     ]},
//     { date: "2025-05-25", label: "Sunday, May 25", matches: [
//       { time: "10:00 SAST", label: "ALL ROUNDS", teamA: "Iron Sights", teamB: "Weekly Duos", tournament: "Iron Sights Weekly", status: "open" }
//     ]},
//     { date: "2025-06-01", label: "Sunday, Jun 1", matches: [
//       { time: "10:00 SAST", label: "GROUP STAGE R1", teamA: "All Teams", teamB: "", tournament: "Midnight Assault", status: "open" }
//     ]}
//   ],

//   announcements: [
//     { id: 1, title: "Operation Warfront — Semi Finals Today", body: "Semi Finals begin at 14:00 SAST. Lobby passwords sent to team captains via WhatsApp.", date: "2025-05-18", type: "live" },
//     { id: 2, title: "Midnight Assault Registration Open", body: "6 slots remaining. Register your squad before May 28.", date: "2025-05-15", type: "info" },
//     { id: 3, title: "Rule Update — Substitution Policy", body: "Substitutions may only be made between maps, effective immediately.", date: "2025-05-10", type: "update" }
//   ]
// };

// // Persist registrations across pages
// if (!localStorage.getItem('wz_registrations')) {
//   localStorage.setItem('wz_registrations', JSON.stringify([]));
// }

// function getRegistrations() {
//   return JSON.parse(localStorage.getItem('wz_registrations') || '[]');
// }

// function saveRegistration(reg) {
//   const regs = getRegistrations();
//   reg.id = Date.now();
//   reg.status = 'pending';
//   reg.submittedAt = new Date().toISOString();
//   regs.push(reg);
//   localStorage.setItem('wz_registrations', JSON.stringify(regs));
//   return reg;
// }
// EVOLVE — Data Layer
// Mock data has been replaced by real API calls in js/api.js
// This file keeps shared utility functions used across pages.

// ── LEGACY WZ STUB ───────────────────────────────────────
// Kept as empty arrays so any page that hasn't been updated
// yet doesn't break. Remove once all pages are wired.
const WZ = {
  tournaments: [],
  teams:       [],
  matches:     [],
  schedule:    [],
  announcements: []
};

// ── SESSION HELPERS ──────────────────────────────────────
// Stores the logged-in user profile in memory (not localStorage)
let _currentUser = null;

function getCurrentUser()    { return _currentUser; }
function setCurrentUser(u)   { _currentUser = u; }
function clearCurrentUser()  { _currentUser = null; }

// ── REGISTRATION HELPERS (legacy — kept for compatibility) ─
function getRegistrations() {
  return JSON.parse(localStorage.getItem('wz_registrations') || '[]');
}

function saveRegistration(reg) {
  const regs = getRegistrations();
  reg.id = Date.now();
  reg.status = 'pending';
  reg.submittedAt = new Date().toISOString();
  regs.push(reg);
  localStorage.setItem('wz_registrations', JSON.stringify(regs));
  return reg;
}
