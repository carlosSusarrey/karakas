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

**Status:** ✅ Basic implementation complete

- [x] Email/password registration and login
- [x] Cookie-based sessions
- [ ] OAuth providers (Google, Discord, GitHub)
- [ ] Password reset flow
- [ ] Email verification

### 2. Deck Management

**Status:** ✅ Phase 1 complete

Users can maintain a library of their decks for quick game logging.

**Requirements:**
- [x] Create/edit/delete decks
- [x] Deck fields:
  - Name
  - Format (Commander, Standard, Modern, Legacy, Vintage, Pioneer, Pauper, Draft, Sealed, etc.)
  - Commander(s) - for Commander/EDH format
  - Partner commander - if applicable
  - EDH Bracket (1-4) - for Commander format
  - Decklist URL (Moxfield, Archidekt, etc.)
- [x] Archive/unarchive decks (soft delete)
- [x] List view with filtering by format
- [ ] Deck detail page showing game history with that deck (requires Game Logging)

### 3. Game Logging

**Status:** 🔲 Not started

The core feature - logging MTG games with detailed information.

**Requirements:**
- [ ] Create new game log
- [ ] Game fields:
  - Format
  - Date/time played
  - Total turns
  - Notes (optional)
- [ ] Add players to game:
  - Select registered user OR enter guest name
  - Select deck from user's library OR enter commander manually
  - EDH bracket for the game
- [ ] Record results:
  - Winner
  - First eliminated player
  - Elimination order/placement
  - Turn eliminated (optional)
- [ ] Edit existing games
- [ ] Delete games
- [ ] Game detail view

### 4. Power Plays

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

### 5. Statistics Dashboard

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

### 6. Social Features

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
├── decks[] (user's decks)
├── gamePlayers[] (games participated in)
└── gamesCreated[] (games logged by user)

Deck
├── id, userId, name, format
├── commander1, commander2, bracket
├── decklistUrl, isActive
└── gamePlayers[] (games played with this deck)

Game
├── id, createdById, format
├── totalTurns, notes, playedAt
├── players[] (GamePlayer records)
└── powerPlays[]

GamePlayer
├── id, gameId, userId, deckId
├── guestName (for non-registered players)
├── commanderUsed1, commanderUsed2, bracketUsed
├── placement, isWinner, isFirstOut, eliminatedTurn
└── powerPlays[]

PowerPlay
├── id, gameId, gamePlayerId, userId
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
│   ├── decks/            # Deck management (TODO)
│   │   ├── page.tsx      # Deck list
│   │   ├── new/          # Create deck
│   │   └── [id]/         # Deck detail/edit
│   ├── games/            # Game logging (TODO)
│   │   ├── page.tsx      # Game history
│   │   ├── new/          # Log new game
│   │   └── [id]/         # Game detail/edit
│   └── stats/            # Statistics (TODO)
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

### Phase 2: Basic Game Logging ⬅️ Next
- Create game logging form
- Add players and results
- Game history list

### Phase 3: Power Plays
- Add power play tracking to game logging
- Power play types and descriptions

### Phase 4: Statistics
- Personal stats dashboard
- Deck performance stats
- Win rate calculations

### Phase 5: Social Features
- Friend system
- Playgroup stats
- Leaderboards

### Phase 6: Polish
- OAuth integration
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

### Decks API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/decks` | List user's decks (TODO) |
| POST | `/api/decks` | Create new deck (TODO) |
| GET | `/api/decks/[id]` | Get deck details (TODO) |
| PATCH | `/api/decks/[id]` | Update deck |
| DELETE | `/api/decks/[id]` | Delete deck |

### Games API (TODO)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List user's games |
| POST | `/api/games` | Create new game |
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
| GET | `/api/stats/playgroup` | Get playgroup statistics |

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
│   ├── decks/
│   │   └── __tests__/   # Component/integration tests
│   ├── games/
│   │   └── __tests__/
│   └── ...
tests/
└── e2e/                 # Playwright E2E tests
    ├── auth.spec.ts
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
| GAME-INT-002 | Create game requires at least 2 players | Shows validation error |
| GAME-INT-003 | Game must have exactly one winner | Shows error if none/multiple |
| GAME-INT-004 | Add guest player (no user account) | Guest name stored |
| GAME-INT-005 | Player can use existing deck | Deck linked to game |
| GAME-INT-006 | Player can enter commander manually | Commander stored without deck |
| GAME-INT-007 | Edit game updates all fields | Changes persisted |
| GAME-INT-008 | Delete game removes all related data | Game and GamePlayers deleted |
| GAME-INT-009 | Elimination order is valid | Placements are sequential |
| GAME-INT-010 | Cannot set eliminated turn > total turns | Shows validation error |

#### E2E Tests (`tests/e2e/games.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| GAME-E2E-001 | Full game logging flow | Create game with all details |
| GAME-E2E-002 | Add/remove players dynamically | Player list updates correctly |
| GAME-E2E-003 | Select deck from dropdown | Deck info auto-fills |
| GAME-E2E-004 | Game history shows recent games | List displays correctly |
| GAME-E2E-005 | Game detail page shows all info | All data visible |

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
