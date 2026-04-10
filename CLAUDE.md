# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karakas is an MTG (Magic: The Gathering) game tracking website where users can log games, manage decks, and view statistics about their playgroup.

## Commands

```bash
# Development
npm run dev           # Start development server at http://localhost:3000
npm run build         # Runs prisma generate && next build
npm run start         # Run production server
npm run lint          # Run ESLint

# Database
npm run db:migrate    # Run Prisma migrations (npx prisma migrate dev)
npm run db:push       # Push schema changes to database (npx prisma db push)
npm run db:studio     # Open Prisma Studio GUI (npx prisma studio)
npm run db:generate   # Generate Prisma client (npx prisma generate)

# Testing
npm run test          # Run all unit/integration tests (Vitest)
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:e2e      # Run Playwright E2E tests
npm run test:e2e:ui   # Run E2E tests with Playwright UI

# Run a single test file
npx vitest run src/path/to/test.test.ts
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

**Structure:**
- `src/app/` - Next.js App Router pages and layouts
- `src/app/**/actions.ts` - Server Actions for form submissions and mutations
- `src/components/` - Shared React components (Header, CommanderImage, CardAutocomplete)
- `src/lib/` - Shared utilities (db client, auth, session, scryfall, oauth, password-reset)
- `src/types/` - TypeScript type definitions (MTG formats, power plays)
- `src/generated/prisma/` - Generated Prisma client (gitignored)
- `prisma/` - Database schema and migrations
- `@/*` path alias maps to `./src/*`

**Database:** Turso (libsql) with Prisma 7 ORM via `@prisma/adapter-libsql`. Singleton client in `src/lib/db.ts`.

**Migrations:** Prisma CLI (`migrate dev`, `db push`) does NOT work with Turso's `libsql://` URLs. To apply migrations, run the SQL directly via Turso CLI: `turso db shell karakas < prisma/migrations/<name>/migration.sql`. Always apply the migration before deploying code that depends on it.

**Key Models:**
- User, OAuthAccount, Session, PasswordResetToken - Authentication
- Playgroup, PlaygroupMember, PlaygroupPlayer - Group management (PlaygroupPlayer = non-registered players who can be claimed/linked)
- PlaygroupInvitation, PlaygroupPlayerClaimToken - Invitation and claiming flows
- Deck, PlaygroupPlayerDeck - Deck management (with commander1, commander2, bracket fields)
- Game, GamePlayer, PowerPlay - Game tracking
- Friendship - Friend requests with pending/accepted/declined status

**Key patterns:**
- Server Components by default (no `'use client'` unless needed)
- Server Actions in `actions.ts` files use `"use server"` directive, return `{ success: true, ... } | { error: string }`
- Tailwind for all styling with dark mode (zinc/amber palette)
- DB-backed sessions via `src/lib/session.ts` — opaque 256-bit tokens in httpOnly cookie, SHA-256 hashed and stored in `Session` table, 7-day expiry
- Use `getCurrentUser()` from `src/lib/auth.ts` for auth checks in server components/actions
- No middleware — all auth checks happen in server components and server actions
- Scryfall API integration in `src/lib/scryfall.ts` with 5-minute in-memory cache

**TypeScript:** Strict mode enabled. Target ES2017.

**MTG Types:** See `src/types/mtg.ts` for formats, brackets, and power play types.

## Authentication

**Password auth:** bcryptjs (12 rounds) via `src/lib/auth.ts`

**OAuth:** Google, Discord, Apple via Arctic library (`src/lib/oauth.ts`). All providers are optional — configured only when env vars are present.
- Flow: `GET /auth/[provider]` → OAuth provider → `GET /auth/[provider]/callback` → `findOrCreateUser()` → session
- Google/Discord use PKCE; Apple decodes JWT from ID token
- OAuth links to existing users by email if account doesn't exist yet

**Password reset:** Token-based via `src/lib/password-reset.ts`, sends emails with Resend. In dev mode without `RESEND_API_KEY`, logs reset URL to console.

## API Routes

- `GET /api/cards/autocomplete?q=&commander=true` — Card search via Scryfall (optional commander-only filter)
- `GET /api/decks/[id]` — Deck details
- `GET /api/playgroups/[id]` — Playgroup details

## Environment Variables

```
# Database (required)
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN

# App
NEXT_PUBLIC_APP_URL          # Default: http://localhost:3000

# OAuth (all optional)
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY

# Email (optional — logs to console in dev if missing)
RESEND_API_KEY
FROM_EMAIL                   # Default: "Karakas <noreply@karakas.app>"
```

## Testing

**Framework:** Vitest (unit/integration) + Playwright (E2E)

**Test structure:**
- `src/__tests__/` - Unit tests for lib utilities
- `src/app/*/__tests__/` - Integration tests for routes/actions
- `src/components/__tests__/` - Component tests
- `tests/e2e/` - End-to-end tests

**Running tests:**
- Always run `npm run test` before committing
- Run `npm run test:e2e` for full user flow validation
