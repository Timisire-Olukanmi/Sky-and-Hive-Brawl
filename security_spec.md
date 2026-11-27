# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Ownership Isolation**: Only the authenticated user whose `request.auth.uid == userId` may read (`get`), create, or update `/users/{userId}` or `/users/{userId}/private/account`. Collection-wide `list` and client `delete` are denied to prevent scraping or accidental destruction.
2. **PII Isolation**: Sensitive fields (`email`, `authProvider`, `isGuest`) are stored exclusively in `/users/{userId}/private/account`, never on `/users/{userId}`.
3. **Immutable Identity & Creation Timestamps**: `uid` must equal `userId` and `request.auth.uid` on create, and both `uid` and `createdAt` must remain immutable on update.
4. **Server-Authoritative Timestamps**: `createdAt` on create and `updatedAt` on create/update must strictly equal `request.time`.
5. **Bounded & Typed Schemas**: Every string has explicit `.size()` bounds; `favoriteFighter`, `defaultMap`, `preferredMode`, and `authProvider` are strictly allowlisted; `scoreboard`, `onlineStats`, and `tournamentStats` contain only strictly bounded non-negative integers and validated `cycleId` format (`^(cycle_[0-9]+|none)$`).
6. **Zero Shadow Fields**: Exact `keys().hasAll(...) && keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` per named update action prevent arbitrary ghost fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unauthenticated Profile Read/Write**: `get` or `set` on `/users/userA` with `auth == null`.
2. **Cross-User Profile Read**: Authenticated as `userB` attempting `get` on `/users/userA`.
3. **Cross-User Private PII Read**: Authenticated as `userB` attempting `get` on `/users/userA/private/account`.
4. **UID Spoofing on Create**: Authenticated as `userA` creating `/users/userA` with `uid: "userB"`.
5. **Shadow / Privilege Escalation Field**: Authenticated as `userA` creating `/users/userA` with extra field `isAdmin: true`.
6. **Collection Scraping (`list`)**: Authenticated as `userA` calling `list` on `/users` or `/users/userA/private`.
7. **ID Poisoning**: Authenticated as `userA` accessing `/users/userA/private/bad$doc!id` or oversized >128 char document ID.
8. **Invalid Fighter Enum**: Authenticated as `userA` writing `favoriteFighter: "hacked_fighter"`.
9. **Negative / Float / Overflow Stats Poisoning**: Authenticated as `userA` writing `scoreboard.p1.wins: -5`, `onlineStats.rankedPoints: 99999`, or `tournamentStats.points: 9999999`.
10. **Invalid Tournament Cycle ID / Display Name Exhaustion**: Authenticated as `userA` writing `tournamentStats.cycleId: "evil_payload"` or a 500-char `displayName`.
11. **Client-Spoofed Timestamp**: Authenticated as `userA` creating/updating with `createdAt` or `updatedAt` not equal to `request.time`.
12. **Immutable Field Mutation**: Authenticated as `userA` updating `/users/userA` while changing `createdAt` or `uid`.
13. **Cross-User Presence Hijack**: Authenticated as `userB` attempting to create, update, or delete `/online_presence/userA` or spoof `uid: "userA"`.
14. **Non-Participant Match Eavesdropping / Signaling Tamper**: Authenticated as `userC` attempting `get`, `update`, or `ice` candidate write on `/online_matches/m_A_vs_B` where neither `hostUid` nor `guestUid` is `userC`.
15. **Guest Overwriting Host Match Fields**: Authenticated as `guestUid` attempting to tamper with `score0`, `offerSdp`, or `hostRelayJson` on `/online_matches/{matchId}`.
16. **Tournament Standing Spoofing**: Authenticated as `userB` attempting to write `/tournament_cycles/cycle_1/standings/userA` or inject negative/overflowing points.

