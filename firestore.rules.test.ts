// Verification test suite specification for Firestore security rules ("Dirty Dozen" payloads)
// Designed for @firebase/rules-unit-testing against firestore.rules.

export const DIRTY_DOZEN_CASES = [
  { name: 'Unauthenticated read on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-user get on /users/userA as userB', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-user get on /users/userA/private/account as userB', expected: 'PERMISSION_DENIED' },
  { name: 'UID spoofing on create (/users/userA with uid=userB)', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow field injection (isAdmin: true)', expected: 'PERMISSION_DENIED' },
  { name: 'Collection list scraping on /users', expected: 'PERMISSION_DENIED' },
  { name: 'Invalid private docId (/users/userA/private/other)', expected: 'PERMISSION_DENIED' },
  { name: 'Invalid favoriteFighter enum value', expected: 'PERMISSION_DENIED' },
  { name: 'Negative or overflowing scoreboard / onlineStats / tournamentStats numbers', expected: 'PERMISSION_DENIED' },
  { name: 'Invalid tournamentStats.cycleId pattern or oversized displayName (> 32 chars)', expected: 'PERMISSION_DENIED' },
  { name: 'Client-spoofed updatedAt timestamp (!= request.time)', expected: 'PERMISSION_DENIED' },
  { name: 'Mutation of immutable uid or createdAt on update', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-user write or UID spoof on /online_presence/userA as userB', expected: 'PERMISSION_DENIED' },
  { name: 'Non-participant read/write on /online_matches/{matchId} or ICE subcollection as userC', expected: 'PERMISSION_DENIED' },
  { name: 'Guest mutating host-only offerSdp/hostRelayJson/score0 on /online_matches/{matchId}', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-user write or invalid points on /tournament_cycles/{cycleId}/standings', expected: 'PERMISSION_DENIED' },
] as const;

