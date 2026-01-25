# Karakas - MTG Game Tracker

## Product Requirements Document

### Overview

Karakas is a Magic: The Gathering game tracking application that allows players to log games, manage decks, and view statistics about their playgroup.

### Target Users

- MTG players who want to track their game history
- Playgroups who want to analyze win rates and trends
- Commander/EDH players who want bracket-aware tracking

---

## Core Features

### 1. User Authentication

**Status:** ✅ Full implementation complete

- [x] Email/password registration and login
- [x] Cookie-based sessions
- [x] OAuth providers (Google, Discord, Apple)
- [x] Password reset flow
- [ ] Email verification

### 2. Playgroups

**Status:** 🔲 Not started

Playgroups are the central organizing concept. All games, decks, and players belong to a playgroup.

**Requirements:**
- [ ] Create/edit/delete playgroups
- [ ] Playgroup fields:
  - Name
  - Description (optional)
  - Default format (optional)
- [ ] Membership management:
  - Invite users to playgroup (by email or username)
  - Accept/decline playgroup invitations
  - Leave playgroup
  - Remove members (owner/admin only)
  - Transfer ownership
- [ ] Playgroup roles:
  - Owner (creator, full control)
  - Admin (can manage members and settings)
  - Member (can log games, add decks)
- [ ] Playgroup players (non-registered):
  - Create placeholder players for people without accounts
  - Placeholder players have a name and optional email
  - When a user signs up, they can claim/link a placeholder player
  - Linking merges all game history to the user account
- [ ] List user's playgroups
- [ ] Playgroup dashboard showing recent games and members

### 3. Deck Management

**Status:** ✅ Phase 1 complete (needs playgroup update)

Decks belong to a playgroup and can be used by any member of that playgroup.

**Requirements:**
- [x] Create/edit/delete decks
- [x] Deck fields:
  - Name
  - Format (Commander, Standard, Modern, Legacy, Vintage, Pioneer, Pauper, Draft, Sealed, etc.)
  - Commander(s) - for Commander/EDH format
  - Partner commander - if applicable
  - EDH Bracket (1-4) - for Commander format
  - Decklist URL (Moxfield, Archidekt, etc.)
- [ ] **Playgroup association:**
  - Deck belongs to a playgroup
  - Deck has an owner (the user who created it)
  - Any playgroup member can use any deck in games
- [x] Archive/unarchive decks (soft delete)
- [x] List view with filtering by format
- [ ] Filter decks by playgroup
- [ ] Deck detail page showing game history with that deck (requires Game Logging)

### 4. Game Logging

**Status:** 🔲 Not started

The core feature - logging MTG games within a playgroup.

**Requirements:**
- [ ] Create new game log
- [ ] Game fields:
  - **Playgroup** (required - game belongs to a playgroup)
  - Format
  - Date/time played
  - Total turns
  - Notes (optional)
- [ ] Add players to game:
  - Select from playgroup members (registered users)
  - Select from playgroup players (non-registered placeholders)
  - Select deck from **any deck in the playgroup** (not just the player's own decks)
  - Alternatively, enter commander manually without a deck
  - EDH bracket for the game
- [ ] Record results:
  - Winner
  - First eliminated player
  - Elimination order/placement
  - Turn eliminated (optional)
- [ ] Edit existing games
- [ ] Delete games
- [ ] Game detail view

### 5. Power Plays

**Status:** 🔲 Not started

Track notable plays that happen during games.

**Power Play Types:**
| Type | Description |
|------|-------------|
| Combo | Executing a game-winning or value combo |
| Board Wipe | Destroying all creatures/permanents |
| Theft | Stealing opponents' permanents |
| Win Condition | Triggering an alternate win condition |
| Removal | Key removal spell |
| Counterspell | Countering a crucial spell |
| Big Ramp | Significant mana acceleration |
| Card Draw | Major card advantage |
| Tutor | Searching for a key card |
| Stax/Lock | Establishing a lock or tax effect |
| Other | Miscellaneous notable play |

**Requirements:**
- [ ] Add power plays during game logging
- [ ] Power play fields:
  - Type (from list above)
  - Turn number
  - Description
  - Card name (optional)
  - Player who made the play
- [ ] Edit/delete power plays
- [ ] View power plays on game detail page

### 6. Statistics Dashboard

**Status:** 🔲 Not started

Aggregate statistics from logged games.

**Requirements:**
- [ ] Personal stats:
  - Total games played
  - Win rate (overall and by format)
  - Most played deck
  - Most played commander
  - Average game length (turns)
  - First elimination rate
- [ ] Deck stats:
  - Win rate per deck
  - Games played per deck
  - Average placement
- [ ] Commander stats:
  - Win rate per commander
  - Most common opponents
- [ ] Power play stats:
  - Most common power play types
  - Power plays per game average
- [ ] Playgroup stats:
  - Head-to-head records
  - Most frequent opponents
- [ ] Filters:
  - Date range
  - Format
  - Specific deck

### 7. Social Features

**Status:** 🔲 Not started

**Requirements:**
- [ ] Friend system (add/remove friends)
- [ ] View friends' public stats
- [ ] Playgroup leaderboards
- [ ] Share game results

---

## Technical Architecture

### Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4 (zinc/amber dark theme)
- **Database:** SQLite with Prisma 7 ORM
- **Auth:** Cookie-based sessions

### Database Models

```
User
├── id, email, username, passwordHash, avatarUrl
├── oauthAccounts[] (OAuth connections)
├── sessions[] (active sessions)
├── playgroupMemberships[] (PlaygroupMember records)
├── decksCreated[] (decks this user created)
├── gamePlayers[] (games participated in)
├── gamesCreated[] (games logged by user)
└── linkedPlaygroupPlayer (optional - claimed placeholder)

Playgroup
├── id, name, description, defaultFormat
├── ownerId (User who owns the playgroup)
├── members[] (PlaygroupMember records)
├── players[] (PlaygroupPlayer records - non-registered)
├── decks[] (all decks in this playgroup)
├── games[] (all games in this playgroup)
└── createdAt, updatedAt

PlaygroupMember
├── id, playgroupId, userId
├── role (owner, admin, member)
├── joinedAt
└── invitedBy (User who sent the invite)

PlaygroupPlayer
├── id, playgroupId, name, email (optional)
├── linkedUserId (null until claimed by a user)
├── gamePlayers[] (games this placeholder participated in)
└── createdAt

Deck
├── id, playgroupId, createdById (User who created it)
├── name, format
├── commander1, commander2, bracket
├── decklistUrl, isActive
└── gamePlayers[] (games played with this deck)

Game
├── id, playgroupId, createdById, format
├── totalTurns, notes, playedAt
├── players[] (GamePlayer records)
└── powerPlays[]

GamePlayer
├── id, gameId, deckId
├── userId (for registered users, nullable)
├── playgroupPlayerId (for non-registered players, nullable)
├── commanderUsed1, commanderUsed2, bracketUsed
├── placement, isWinner, isFirstOut, eliminatedTurn
└── powerPlays[]

PowerPlay
├── id, gameId, gamePlayerId
├── turn, type, description, cardName
└── createdAt
```

### Project Structure

```
src/
├── app/
│   ├── page.tsx          # Homepage
│   ├── layout.tsx        # Root layout
│   ├── login/            # Login page
│   ├── signup/           # Registration page
│   ├── logout/           # Logout route
│   ├── playgroups/       # Playgroup management
│   │   ├── page.tsx      # List user's playgroups
│   │   ├── new/          # Create playgroup
│   │   └── [id]/         # Playgroup dashboard
│   │       ├── page.tsx  # Playgroup overview
│   │       ├── members/  # Member management
│   │       ├── players/  # Playgroup players (non-registered)
│   │       ├── decks/    # Playgroup decks
│   │       ├── games/    # Playgroup games
│   │       └── settings/ # Playgroup settings
│   ├── decks/            # Deck management
│   │   ├── page.tsx      # Deck list (all playgroups)
│   │   ├── new/          # Create deck (select playgroup)
│   │   └── [id]/         # Deck detail/edit
│   ├── games/            # Game logging
│   │   ├── page.tsx      # Game history (all playgroups)
│   │   ├── new/          # Log new game (select playgroup)
│   │   └── [id]/         # Game detail/edit
│   ├── stats/            # Statistics (TODO)
│   └── claim/            # Claim playgroup player
│       └── [token]/      # Claim flow with token
├── lib/
│   ├── db.ts             # Prisma client
│   ├── auth.ts           # Auth utilities
│   └── session.ts        # Session management
├── types/
│   └── mtg.ts            # MTG constants (formats, brackets, power plays)
└── generated/
    └── prisma/           # Generated Prisma client
```

---

## Implementation Phases

### Phase 1: Deck Management ✅ Complete
- Create deck CRUD pages
- Deck list with format filtering
- Support for commander formats with bracket
- Archive/unarchive functionality

### Phase 2: Playgroups ⬅️ Next
- Playgroup CRUD (create, edit, delete)
- Playgroup membership (invite, accept, leave)
- Playgroup players (non-registered placeholders)
- Migrate existing decks to require playgroup association
- Playgroup dashboard with member list

### Phase 3: Playgroup-Based Game Logging
- Create game logging form within playgroup context
- Select players from playgroup members + playgroup players
- Select decks from any deck in the playgroup
- Add players and results
- Game history list (filterable by playgroup)

### Phase 4: Player Claiming
- Allow new users to claim existing playgroup players
- Merge game history when claiming
- Email-based claim invitations

### Phase 5: Power Plays
- Add power play tracking to game logging
- Power play types and descriptions

### Phase 6: Statistics
- Personal stats dashboard
- Deck performance stats
- Win rate calculations
- Playgroup-level statistics

### Phase 7: Social Features
- Friend system
- Cross-playgroup stats
- Leaderboards

### Phase 8: Polish
- Email verification
- Mobile responsiveness improvements
- Performance optimization

---

## Design Guidelines

- **Theme:** Dark mode with zinc backgrounds and amber accents
- **Typography:** Geist Sans/Mono fonts
- **Components:** Keep it simple, use native form elements with Tailwind styling
- **Patterns:** Server Components by default, 'use client' only when needed

---

## API Routes

### Playgroups API (TODO)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/playgroups` | List user's playgroups |
| POST | `/api/playgroups` | Create new playgroup |
| GET | `/api/playgroups/[id]` | Get playgroup details |
| PATCH | `/api/playgroups/[id]` | Update playgroup |
| DELETE | `/api/playgroups/[id]` | Delete playgroup |
| POST | `/api/playgroups/[id]/invite` | Invite user to playgroup |
| POST | `/api/playgroups/[id]/join` | Accept playgroup invitation |
| DELETE | `/api/playgroups/[id]/leave` | Leave playgroup |
| DELETE | `/api/playgroups/[id]/members/[userId]` | Remove member from playgroup |

### Playgroup Players API (TODO)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/playgroups/[id]/players` | List playgroup players |
| POST | `/api/playgroups/[id]/players` | Create playgroup player (placeholder) |
| PATCH | `/api/playgroups/[id]/players/[playerId]` | Update playgroup player |
| DELETE | `/api/playgroups/[id]/players/[playerId]` | Delete playgroup player |
| POST | `/api/playgroups/[id]/players/[playerId]/claim` | Claim playgroup player |
| POST | `/api/playgroups/[id]/players/[playerId]/invite` | Send claim invitation email |

### Decks API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/decks` | List user's decks (across all playgroups) |
| GET | `/api/playgroups/[id]/decks` | List decks in a playgroup |
| POST | `/api/playgroups/[id]/decks` | Create deck in playgroup |
| GET | `/api/decks/[id]` | Get deck details |
| PATCH | `/api/decks/[id]` | Update deck |
| DELETE | `/api/decks/[id]` | Delete deck |

### Games API (TODO)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List user's games (across all playgroups) |
| GET | `/api/playgroups/[id]/games` | List games in a playgroup |
| POST | `/api/playgroups/[id]/games` | Create game in playgroup |
| GET | `/api/games/[id]` | Get game details |
| PATCH | `/api/games/[id]` | Update game |
| DELETE | `/api/games/[id]` | Delete game |

### Power Plays API (TODO)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games/[id]/power-plays` | Add power play to game |
| PATCH | `/api/power-plays/[id]` | Update power play |
| DELETE | `/api/power-plays/[id]` | Delete power play |

### Stats API (TODO)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/personal` | Get personal statistics |
| GET | `/api/stats/decks` | Get deck statistics |
| GET | `/api/playgroups/[id]/stats` | Get playgroup statistics |

---

## Testing Strategy

### Testing Framework

- **Unit/Integration Tests:** Vitest
- **Component Tests:** React Testing Library
- **E2E Tests:** Playwright

### Test Commands

```bash
npm run test              # Run all unit/integration tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run test:e2e          # Run Playwright E2E tests
npm run test:e2e:ui       # Run E2E tests with Playwright UI
```

### Test File Structure

```
src/
├── __tests__/           # Unit tests for lib utilities
│   ├── auth.test.ts
│   ├── session.test.ts
│   └── mtg.test.ts
├── app/
│   ├── playgroups/
│   │   └── __tests__/   # Playgroup integration tests
│   ├── decks/
│   │   └── __tests__/   # Deck integration tests
│   ├── games/
│   │   └── __tests__/   # Game integration tests
│   └── ...
tests/
└── e2e/                 # Playwright E2E tests
    ├── auth.spec.ts
    ├── playgroups.spec.ts
    ├── decks.spec.ts
    ├── games.spec.ts
    └── stats.spec.ts
```

---

## Test Cases

### Authentication Tests

#### Unit Tests (`src/__tests__/auth.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AUTH-001 | `hashPassword` hashes password correctly | Returns bcrypt hash |
| AUTH-002 | `verifyPassword` validates correct password | Returns true |
| AUTH-003 | `verifyPassword` rejects incorrect password | Returns false |
| AUTH-004 | `getCurrentUser` returns null when no session | Returns null |
| AUTH-005 | `getCurrentUser` returns user for valid session | Returns user object |
| AUTH-006 | `getCurrentUser` returns null for expired session | Returns null |

#### Integration Tests (`src/app/login/__tests__/login.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AUTH-INT-001 | Login with valid credentials | Redirects to home, creates session |
| AUTH-INT-002 | Login with invalid email | Shows error message |
| AUTH-INT-003 | Login with invalid password | Shows error message |
| AUTH-INT-004 | Login with empty fields | Shows validation errors |
| AUTH-INT-005 | Signup creates new user | User created, session started |
| AUTH-INT-006 | Signup with existing email | Shows error message |
| AUTH-INT-007 | Logout destroys session | Session deleted, redirected |

#### E2E Tests (`tests/e2e/auth.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AUTH-E2E-001 | Full signup flow | Can create account and login |
| AUTH-E2E-002 | Full login/logout flow | Can login and logout |
| AUTH-E2E-003 | Protected routes redirect | Unauthenticated users redirected to login |
| AUTH-E2E-004 | Session persists across pages | User stays logged in |

### Playgroup Tests

#### Integration Tests (`src/app/playgroups/__tests__/playgroups.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PG-INT-001 | Create playgroup with valid data | Playgroup created, user is owner |
| PG-INT-002 | Create playgroup without name | Shows validation error |
| PG-INT-003 | Edit playgroup updates fields | Changes persisted |
| PG-INT-004 | Delete playgroup removes all data | Playgroup, members, decks, games deleted |
| PG-INT-005 | Only owner can delete playgroup | Returns 403 for non-owners |
| PG-INT-006 | Invite user to playgroup | Invitation sent |
| PG-INT-007 | Accept playgroup invitation | User becomes member |
| PG-INT-008 | Decline playgroup invitation | Invitation removed |
| PG-INT-009 | Leave playgroup | Membership removed |
| PG-INT-010 | Owner cannot leave (must transfer) | Shows error message |
| PG-INT-011 | Remove member from playgroup | Member removed |
| PG-INT-012 | Only admin/owner can remove members | Returns 403 for members |
| PG-INT-013 | Transfer ownership | New owner set, old becomes admin |

#### Playgroup Players Tests (`src/app/playgroups/__tests__/players.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PGP-INT-001 | Create playgroup player | Player created |
| PGP-INT-002 | Create player without name | Shows validation error |
| PGP-INT-003 | Edit playgroup player | Changes persisted |
| PGP-INT-004 | Delete playgroup player | Player deleted |
| PGP-INT-005 | Cannot delete player with games | Shows error or cascades |
| PGP-INT-006 | Claim playgroup player | Player linked to user |
| PGP-INT-007 | Claim merges game history | All games show user |
| PGP-INT-008 | Cannot claim already-claimed player | Shows error |
| PGP-INT-009 | Send claim invitation email | Email sent with token |
| PGP-INT-010 | Claim via email token | Player linked to user |

#### E2E Tests (`tests/e2e/playgroups.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PG-E2E-001 | Full playgroup CRUD flow | Create, view, edit, delete works |
| PG-E2E-002 | Invite and join flow | User can join via invitation |
| PG-E2E-003 | Create playgroup player | Placeholder player created |
| PG-E2E-004 | New user claims player | Game history transferred |
| PG-E2E-005 | Playgroup dashboard shows data | Members, games, decks visible |

### Deck Management Tests

#### Unit Tests (`src/__tests__/mtg.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| DECK-001 | `MTG_FORMATS` contains all formats | All formats present |
| DECK-002 | `COMMANDER_FORMATS` subset is correct | Commander variants only |
| DECK-003 | `EDH_BRACKETS` are 1-4 | Valid brackets array |

#### Integration Tests (`src/app/decks/__tests__/decks.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| DECK-INT-001 | Create deck with valid data | Deck created, redirected to list |
| DECK-INT-002 | Create deck without name | Shows validation error |
| DECK-INT-003 | Create Commander deck requires commander | Shows error if missing |
| DECK-INT-004 | Edit deck updates all fields | Changes persisted |
| DECK-INT-005 | Archive deck sets isActive=false | Deck archived |
| DECK-INT-006 | Unarchive deck sets isActive=true | Deck restored |
| DECK-INT-007 | Delete deck removes from database | Deck deleted |
| DECK-INT-008 | List filters by format | Only matching decks shown |
| DECK-INT-009 | Cannot access other user's deck | Returns 404 or 403 |
| DECK-INT-010 | Partner commander optional | Deck created with one commander |

#### E2E Tests (`tests/e2e/decks.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| DECK-E2E-001 | Full deck CRUD flow | Create, view, edit, delete works |
| DECK-E2E-002 | Archive/unarchive toggle | Deck visibility changes |
| DECK-E2E-003 | Format filtering works | List updates on filter change |
| DECK-E2E-004 | Commander fields show/hide | Fields appear for Commander format |
| DECK-E2E-005 | Decklist URL is clickable | External link opens correctly |

### Game Logging Tests

#### Integration Tests (`src/app/games/__tests__/games.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| GAME-INT-001 | Create game with valid data | Game created with players |
| GAME-INT-002 | Create game requires playgroup | Shows validation error |
| GAME-INT-003 | Create game requires at least 2 players | Shows validation error |
| GAME-INT-004 | Game must have exactly one winner | Shows error if none/multiple |
| GAME-INT-005 | Add playgroup player (non-registered) | PlaygroupPlayer linked |
| GAME-INT-006 | Add registered user from playgroup | User linked to game |
| GAME-INT-007 | Player can use any playgroup deck | Deck linked to game |
| GAME-INT-008 | Player can enter commander manually | Commander stored without deck |
| GAME-INT-009 | Edit game updates all fields | Changes persisted |
| GAME-INT-010 | Delete game removes all related data | Game and GamePlayers deleted |
| GAME-INT-011 | Elimination order is valid | Placements are sequential |
| GAME-INT-012 | Cannot set eliminated turn > total turns | Shows validation error |
| GAME-INT-013 | Only playgroup members can create games | Returns 403 for non-members |
| GAME-INT-014 | Cannot select deck from other playgroup | Shows validation error |

#### E2E Tests (`tests/e2e/games.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| GAME-E2E-001 | Full game logging flow | Create game with all details |
| GAME-E2E-002 | Add/remove players dynamically | Player list updates correctly |
| GAME-E2E-003 | Select deck from playgroup | Deck info auto-fills |
| GAME-E2E-004 | Mix registered and placeholder players | Both types work |
| GAME-E2E-005 | Game history shows recent games | List displays correctly |
| GAME-E2E-006 | Game detail page shows all info | All data visible |
| GAME-E2E-007 | Filter games by playgroup | Only playgroup games shown |

### Power Play Tests

#### Integration Tests (`src/app/games/__tests__/power-plays.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PP-INT-001 | Add power play to game | Power play created |
| PP-INT-002 | Power play requires type | Shows validation error |
| PP-INT-003 | Power play turn <= total turns | Shows error if invalid |
| PP-INT-004 | Edit power play updates fields | Changes persisted |
| PP-INT-005 | Delete power play removes record | Power play deleted |
| PP-INT-006 | Power play linked to correct player | Association correct |

#### E2E Tests (`tests/e2e/games.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PP-E2E-001 | Add power play during game logging | Power play appears in list |
| PP-E2E-002 | View power plays on game detail | All power plays displayed |
| PP-E2E-003 | Filter games by power play type | Filtering works correctly |

### Statistics Tests

#### Unit Tests (`src/__tests__/stats.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| STATS-001 | Calculate win rate correctly | Percentage is accurate |
| STATS-002 | Handle zero games edge case | Returns 0% or N/A |
| STATS-003 | Calculate average turns correctly | Average is accurate |
| STATS-004 | Calculate first elimination rate | Percentage is accurate |

#### Integration Tests (`src/app/stats/__tests__/stats.test.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| STATS-INT-001 | Personal stats aggregate correctly | All stats calculated |
| STATS-INT-002 | Deck stats per deck are correct | Per-deck breakdown works |
| STATS-INT-003 | Date range filter works | Only filtered games counted |
| STATS-INT-004 | Format filter works | Only filtered format counted |
| STATS-INT-005 | Head-to-head records correct | Win/loss vs opponent tracked |

#### E2E Tests (`tests/e2e/stats.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| STATS-E2E-001 | Stats dashboard loads | All sections visible |
| STATS-E2E-002 | Filters update stats | Numbers change on filter |
| STATS-E2E-003 | Empty state shows correctly | "No games yet" message |

### Social Features Tests

#### Integration Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SOCIAL-INT-001 | Send friend request | Request created |
| SOCIAL-INT-002 | Accept friend request | Friendship established |
| SOCIAL-INT-003 | Decline friend request | Request deleted |
| SOCIAL-INT-004 | Remove friend | Friendship deleted |
| SOCIAL-INT-005 | View friend's public stats | Stats visible |
| SOCIAL-INT-006 | Playgroup leaderboard calculates | Rankings correct |

#### E2E Tests (`tests/e2e/social.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SOCIAL-E2E-001 | Full friend request flow | Send, accept, view |
| SOCIAL-E2E-002 | Leaderboard displays correctly | Rankings visible |
| SOCIAL-E2E-003 | Share game result | Shareable link works |

---

## Non-Functional Requirements

### Performance

- Page load time < 2 seconds on 3G connection
- Database queries < 100ms for common operations
- Support 1000+ games per user without degradation

### Security

- Passwords hashed with bcrypt (cost factor 10+)
- Session tokens are cryptographically secure
- SQL injection prevention via Prisma
- XSS prevention via React's default escaping
- CSRF protection on form submissions

### Accessibility

- WCAG 2.1 AA compliance target
- Keyboard navigation support
- Screen reader compatible
- Color contrast ratios meet guidelines

### Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

---

## Future Considerations

- **Mobile App:** React Native version sharing core logic
- **Card Database Integration:** Scryfall API for card autocomplete
- **Deck Import:** Import decklists from Moxfield/Archidekt
- **Tournament Support:** Swiss/bracket tournament tracking
- **Analytics:** Advanced visualizations with charts
- **Notifications:** Game invites and stat milestones
