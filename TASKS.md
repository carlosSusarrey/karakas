# Karakas Improvement Tasks

This file tracks progress on two major improvement initiatives.

---

## Task 1: Test Coverage

### Goal
Create tests for every untested part of the website.

### Current Coverage Summary
- **Total Files**: ~72
- **Tested**: 19 test suites (373 tests total)
- **Overall Coverage**: ~50% (server actions, API routes, libraries, and components covered)

### Existing Test Files
1. `src/__tests__/mtg.test.ts` - MTG type definitions (11 tests)
2. `src/app/playgroups/__tests__/actions.test.ts` - Playgroup CRUD actions (26 tests)
3. `src/app/playgroups/__tests__/players.test.ts` - Playgroup player actions (16 tests)
4. `src/app/playgroups/__tests__/player-decks.test.ts` - Playgroup player deck actions (30 tests)
5. `src/app/decks/__tests__/actions.test.ts` - Deck CRUD actions (32 tests)
6. `src/app/games/__tests__/actions.test.ts` - Game actions (44 tests)
7. `src/app/auth/__tests__/actions.test.ts` - Auth actions (29 tests)
8. `src/app/friends/__tests__/actions.test.ts` - Friend actions (31 tests)
9. `src/app/api/__tests__/routes.test.ts` - API routes (26 tests) ✅ NEW
10. `src/app/auth/__tests__/oauth.test.ts` - OAuth routes (14 tests) ✅ NEW
11. `src/__tests__/lib/auth.test.ts` - Auth library (14 tests) ✅ NEW
12. `src/__tests__/lib/session.test.ts` - Session library (11 tests) ✅ NEW
13. `src/__tests__/lib/password-reset.test.ts` - Password reset library (7 tests) ✅ NEW
14. `src/__tests__/lib/scryfall.test.ts` - Scryfall API client (22 tests) ✅ NEW
15. `src/__tests__/lib/email.test.ts` - Email sending (5 tests) ✅ NEW
16. `src/__tests__/lib/oauth.test.ts` - OAuth helpers (6 tests) ✅ NEW
17. `src/components/__tests__/header.test.tsx` - Header component (21 tests) ✅ NEW
18. `src/components/__tests__/card-autocomplete.test.tsx` - Card autocomplete (14 tests) ✅ NEW
19. `src/components/__tests__/commander-image.test.tsx` - Commander image (14 tests) ✅ NEW
20. `tests/e2e/auth.spec.ts` - Auth E2E tests
21. `tests/e2e/decks.spec.ts` - Deck E2E tests (mostly skipped)
22. `tests/e2e/playgroup-player-decks.spec.ts` - Player deck E2E tests (mostly skipped)

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

#### Priority 2: API Routes (6 untested) ✅ COMPLETE
- [x] `src/app/api/cards/autocomplete/route.ts` - Card search
- [x] `src/app/api/decks/[id]/route.ts` - Deck API
- [x] `src/app/api/playgroups/[id]/route.ts` - Playgroup API
- [x] `src/app/auth/[provider]/callback/route.ts` - OAuth callback
- [x] `src/app/auth/[provider]/route.ts` - OAuth initiation
- [x] `src/app/logout/route.ts` - Logout

#### Priority 3: Library Utilities (6 untested) ✅ COMPLETE
- [x] `src/lib/auth.ts` - Authentication helpers
- [x] `src/lib/email.ts` - Email sending
- [x] `src/lib/oauth.ts` - OAuth helpers
- [x] `src/lib/password-reset.ts` - Password reset logic
- [x] `src/lib/scryfall.ts` - Scryfall API client
- [x] `src/lib/session.ts` - Session management

#### Priority 4: Shared Components (3 untested) ✅ COMPLETE
- [x] `src/components/card-autocomplete.tsx`
- [x] `src/components/commander-image.tsx`
- [x] `src/components/header.tsx`

### Completed
- ✅ All server actions (4 test files, 136 tests)
- ✅ All API routes (2 test files, 40 tests)
- ✅ All library utilities (6 test files, 65 tests)
- ✅ All shared components (3 test files, 49 tests)

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

### Files with useEffect (5 total calls in 4 files after conversions)

#### 1. `src/components/card-autocomplete.tsx` - 2 useEffect calls
- **Lines 46-76**: Fetches card suggestions when debounced value changes
  - Status: ⚠️ Could use React Query or server action
- **Lines 79-93**: Closes dropdown when clicking outside
  - Status: ✅ Acceptable - event listener cleanup pattern

#### 2. `src/app/games/new/page.tsx` - 2 useEffect calls
- **Lines 67-99**: Loads playgroup data on mount
  - Status: ⚠️ Complex - uses useSearchParams, would require significant refactoring
- **Lines 102-120**: Loads decks when format changes
  - Status: ⚠️ Could be refactored with server actions

#### 3. `src/hooks/use-debounce.ts` - 1 useEffect call
- **Lines 6-14**: Debounces value changes
  - Status: ✅ Acceptable - proper custom hook pattern

#### 4. `src/components/header.tsx` - 1 useEffect call
- **Lines 25-34**: Closes dropdown when clicking outside
  - Status: ✅ Acceptable - event listener cleanup pattern

### Conversion Priority

#### High Priority (Should be Server Components) ✅ COMPLETE
- [x] `src/app/decks/[id]/edit/page.tsx` - Data fetching on mount → Converted to server component
- [x] `src/app/playgroups/[id]/settings/page.tsx` - Data fetching on mount → Converted to server component

#### Medium Priority (Could be improved) ✅ PARTIAL
- [ ] `src/app/games/new/page.tsx` - Complex refactoring needed (deferred)
- [ ] `src/components/card-autocomplete.tsx` - Consider React Query (acceptable as-is)
- [x] `src/app/login/page.tsx` - URL params handling → Converted to server component + client form
- [x] `src/app/signup/page.tsx` - URL params handling → Converted to server component + client form

#### Low Priority (Acceptable patterns)
- [x] `src/hooks/use-debounce.ts` - Proper hook pattern
- [x] `src/components/header.tsx` - Event listener cleanup
- [x] `src/components/card-autocomplete.tsx` (outside click) - Event listener cleanup

#### Cleanup ✅ COMPLETE
- [x] `src/app/reset-password/[token]/page.tsx` - Remove unused import

### Completed Conversions
- ✅ Removed unused useEffect import from reset-password page
- ✅ `src/app/decks/[id]/edit/page.tsx` - Converted to server component with EditDeckForm client component
- ✅ `src/app/playgroups/[id]/settings/page.tsx` - Converted to server component with PlaygroupSettingsForm client component
- ✅ `src/app/login/page.tsx` - Converted to server component with LoginForm client component (reads searchParams server-side)
- ✅ `src/app/signup/page.tsx` - Converted to server component with SignUpForm client component (reads searchParams server-side)

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

### Session 2 - 2026-01-25 (continued)
- **Created tests for all API routes:**
  - `src/app/api/__tests__/routes.test.ts` (26 tests) - card autocomplete, deck API, playgroup API, logout
  - `src/app/auth/__tests__/oauth.test.ts` (14 tests) - OAuth initiation and callback routes
- **Created tests for all library utilities:**
  - `src/__tests__/lib/auth.test.ts` (14 tests) - hashPassword, verifyPassword, signUp, signIn, signOut, getCurrentUser, updatePassword
  - `src/__tests__/lib/session.test.ts` (11 tests) - createSession, getSession, deleteSession, getCurrentUserId
  - `src/__tests__/lib/password-reset.test.ts` (7 tests) - createPasswordResetToken, validatePasswordResetToken, consumePasswordResetToken
  - `src/__tests__/lib/scryfall.test.ts` (22 tests) - autocompleteCards, getCardByName, getCardImageUrlFromCard, isLegendaryCreature, canBeCommander, getCardImageUrl
  - `src/__tests__/lib/email.test.ts` (5 tests) - sendPasswordResetEmail dev/prod modes
  - `src/__tests__/lib/oauth.test.ts` (6 tests) - provider configuration, OAUTH_PROVIDERS, getEnabledProviders
- **Created tests for all shared components:**
  - `src/components/__tests__/header.test.tsx` (21 tests) - rendering, dropdown menu, active tab highlighting, navigation links
  - `src/components/__tests__/card-autocomplete.test.tsx` (14 tests) - rendering, input handling, accessibility, query handling
  - `src/components/__tests__/commander-image.test.tsx` (14 tests) - image rendering, placeholder, size variants
- **useEffect cleanup:**
  - Removed unused useEffect import from `src/app/reset-password/[token]/page.tsx`
- **Added jest-dom setup for component testing:**
  - Installed `@testing-library/jest-dom`
  - Updated `vitest.setup.ts` with jest-dom matchers
- Total test count: 373 tests (was 219)

### Session 3 - 2026-01-25 (continued)
- **Converted useEffect data-fetching pages to server components:**
  - `src/app/decks/[id]/edit/page.tsx` → Server component + EditDeckForm client component
  - `src/app/playgroups/[id]/settings/page.tsx` → Server component + PlaygroupSettingsForm client component
  - `src/app/login/page.tsx` → Server component + LoginForm client component
  - `src/app/signup/page.tsx` → Server component + SignUpForm client component
- **Benefits of conversions:**
  - Eliminated 4 useEffect calls for data fetching
  - Server-side rendering for faster initial page loads
  - Better SEO (server-rendered content)
  - Simpler error handling (redirects on server instead of client)
  - URL params read server-side without useSearchParams hook
- **Remaining useEffect usages (5 total, all acceptable):**
  - 2 in card-autocomplete.tsx (debounced fetch + click outside)
  - 2 in games/new/page.tsx (complex form state - deferred)
  - 1 in use-debounce.ts (proper hook pattern)
  - 1 in header.tsx (click outside dropdown)
- All tests passing (373 tests)
- Build successful
