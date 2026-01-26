# Karakas Improvement Tasks

This file tracks progress on two major improvement initiatives.

---

## Task 1: Test Coverage

### Goal
Create tests for every untested part of the website.

### Current Coverage Summary
- **Total Files**: ~72
- **Tested**: 8 test suites (219 tests total)
- **Overall Coverage**: ~15% (server actions fully covered)

### Existing Test Files
1. `src/__tests__/mtg.test.ts` - MTG type definitions (11 tests)
2. `src/app/playgroups/__tests__/actions.test.ts` - Playgroup CRUD actions (26 tests)
3. `src/app/playgroups/__tests__/players.test.ts` - Playgroup player actions (16 tests)
4. `src/app/playgroups/__tests__/player-decks.test.ts` - Playgroup player deck actions (30 tests)
5. `src/app/decks/__tests__/actions.test.ts` - Deck CRUD actions (32 tests) ✅ NEW
6. `src/app/games/__tests__/actions.test.ts` - Game actions (44 tests) ✅ NEW
7. `src/app/auth/__tests__/actions.test.ts` - Auth actions (29 tests) ✅ NEW
8. `src/app/friends/__tests__/actions.test.ts` - Friend actions (31 tests) ✅ NEW
9. `tests/e2e/auth.spec.ts` - Auth E2E tests
10. `tests/e2e/decks.spec.ts` - Deck E2E tests (mostly skipped)
11. `tests/e2e/playgroup-player-decks.spec.ts` - Player deck E2E tests (mostly skipped)

### Tests to Create

#### Priority 1: Server Actions (10 untested) ✅ COMPLETE
- [x] `src/app/decks/[id]/actions.ts` - Deck update/delete/archive
- [x] `src/app/decks/new/actions.ts` - Deck creation
- [x] `src/app/friends/actions.ts` - Friend management
- [x] `src/app/games/[id]/edit/actions.ts` - Game editing
- [x] `src/app/games/[id]/play/actions.ts` - Game play actions
- [x] `src/app/games/new/actions.ts` - Game creation
- [x] `src/app/login/actions.ts` - Login action
- [x] `src/app/signup/actions.ts` - Signup action
- [x] `src/app/forgot-password/actions.ts` - Password reset request
- [x] `src/app/reset-password/[token]/actions.ts` - Password reset

#### Priority 2: API Routes (6 untested)
- [ ] `src/app/api/cards/autocomplete/route.ts` - Card search
- [ ] `src/app/api/decks/[id]/route.ts` - Deck API
- [ ] `src/app/api/playgroups/[id]/route.ts` - Playgroup API
- [ ] `src/app/auth/[provider]/callback/route.ts` - OAuth callback
- [ ] `src/app/auth/[provider]/route.ts` - OAuth initiation
- [ ] `src/app/logout/route.ts` - Logout

#### Priority 3: Library Utilities (6 untested)
- [ ] `src/lib/auth.ts` - Authentication helpers
- [ ] `src/lib/email.ts` - Email sending
- [ ] `src/lib/oauth.ts` - OAuth helpers
- [ ] `src/lib/password-reset.ts` - Password reset logic
- [ ] `src/lib/scryfall.ts` - Scryfall API client
- [ ] `src/lib/session.ts` - Session management

#### Priority 4: Shared Components (3 untested)
- [ ] `src/components/card-autocomplete.tsx`
- [ ] `src/components/commander-image.tsx`
- [ ] `src/components/header.tsx`

### Completed
- ✅ All server actions (4 new test files, 136 new tests)

---

## Task 2: useEffect Audit

### Goal
Audit the codebase to find useEffect usages and convert them to better patterns (hooks, server components, etc.).

### Why useEffect is Often Problematic
- Can cause unnecessary re-renders
- Often used for data fetching that should be server-side
- Can lead to race conditions
- Makes components harder to test
- Often indicates missing abstraction

### Better Alternatives
- Server Components for data fetching
- Custom hooks for reusable logic
- Event handlers for user interactions
- useSyncExternalStore for external state
- useCallback/useMemo for derived values

### Files with useEffect (10 total calls in 8 files)

#### 1. `src/components/card-autocomplete.tsx` - 2 useEffect calls
- **Lines 46-76**: Fetches card suggestions when debounced value changes
  - Status: ⚠️ Could use React Query or server action
- **Lines 79-93**: Closes dropdown when clicking outside
  - Status: ✅ Acceptable - event listener cleanup pattern

#### 2. `src/app/games/new/page.tsx` - 2 useEffect calls
- **Lines 67-99**: Loads playgroup data on mount
  - Status: ❌ Should be server component with data fetching
- **Lines 102-120**: Loads decks when format changes
  - Status: ⚠️ Could be refactored with server actions

#### 3. `src/app/decks/[id]/edit/page.tsx` - 1 useEffect call
- **Lines 43-63**: Loads deck data on mount
  - Status: ❌ Should be server component with data fetching

#### 4. `src/hooks/use-debounce.ts` - 1 useEffect call
- **Lines 6-14**: Debounces value changes
  - Status: ✅ Acceptable - proper custom hook pattern

#### 5. `src/app/playgroups/[id]/settings/page.tsx` - 1 useEffect call
- **Lines 32-46**: Loads playgroup data on mount
  - Status: ❌ Should be server component with data fetching

#### 6. `src/components/header.tsx` - 1 useEffect call
- **Lines 25-34**: Closes dropdown when clicking outside
  - Status: ✅ Acceptable - event listener cleanup pattern

#### 7. `src/app/signup/page.tsx` - 1 useEffect call
- **Lines 62-67**: Handles OAuth error from URL params
  - Status: ⚠️ Could use searchParams prop directly in server component

#### 8. `src/app/login/page.tsx` - 1 useEffect call
- **Lines 62-67**: Handles OAuth error from URL params
  - Status: ⚠️ Could use searchParams prop directly in server component

#### 9. `src/app/reset-password/[token]/page.tsx`
- Imports useEffect but doesn't use it - can remove import

### Conversion Priority

#### High Priority (Should be Server Components)
- [ ] `src/app/games/new/page.tsx` - Data fetching on mount
- [ ] `src/app/decks/[id]/edit/page.tsx` - Data fetching on mount
- [ ] `src/app/playgroups/[id]/settings/page.tsx` - Data fetching on mount

#### Medium Priority (Could be improved)
- [ ] `src/components/card-autocomplete.tsx` - Consider React Query
- [ ] `src/app/login/page.tsx` - URL params handling
- [ ] `src/app/signup/page.tsx` - URL params handling

#### Low Priority (Acceptable patterns)
- [x] `src/hooks/use-debounce.ts` - Proper hook pattern
- [x] `src/components/header.tsx` - Event listener cleanup
- [x] `src/components/card-autocomplete.tsx` (outside click) - Event listener cleanup

#### Cleanup
- [ ] `src/app/reset-password/[token]/page.tsx` - Remove unused import

### Completed Conversions
_None yet_

---

## Session Log

### Session 1 - 2026-01-25
- Created this tracking file
- Completed initial audit of test coverage
- Completed audit of useEffect usages
- Identified:
  - 10 untested server actions
  - 6 untested API routes
  - 6 untested library utilities
  - 3 untested shared components
  - 10 useEffect calls across 8 files (3 need refactoring, 4 acceptable, 3 could be improved)
- **Created tests for all server actions:**
  - `src/app/decks/__tests__/actions.test.ts` (32 tests) - createDeck, deleteDeck, toggleArchiveDeck, updateDeck
  - `src/app/games/__tests__/actions.test.ts` (44 tests) - createGame, getUserDecks, getPlaygroupData, updateGame, deleteGame, updateTurnCount, eliminatePlayer, reinstatePlayer, addPowerPlay, removePowerPlay, endGame
  - `src/app/auth/__tests__/actions.test.ts` (29 tests) - login, signup, requestPasswordReset, resetPassword
  - `src/app/friends/__tests__/actions.test.ts` (31 tests) - sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, cancelFriendRequest
- Total test count: 219 tests (was 83)
