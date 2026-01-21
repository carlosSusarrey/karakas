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

**Status:** 🔲 Not started

Users can maintain a library of their decks for quick game logging.

**Requirements:**
- [ ] Create/edit/delete decks
- [ ] Deck fields:
  - Name
  - Format (Commander, Standard, Modern, Legacy, Vintage, Pioneer, Pauper, Draft, Sealed, etc.)
  - Commander(s) - for Commander/EDH format
  - Partner commander - if applicable
  - EDH Bracket (1-4) - for Commander format
  - Decklist URL (Moxfield, Archidekt, etc.)
- [ ] Archive/unarchive decks (soft delete)
- [ ] List view with filtering by format
- [ ] Deck detail page showing game history with that deck

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

### Phase 1: Deck Management ⬅️ Next
- Create deck CRUD pages
- Deck list with format filtering
- Support for commander formats with bracket

### Phase 2: Basic Game Logging
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
