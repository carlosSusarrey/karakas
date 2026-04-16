# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karakas is an MTG (Magic: The Gathering) game tracking platform with a web app and mobile app (life counter + full game management).

## Monorepo Structure

This is an npm workspaces monorepo:

```
karakas/
├── apps/
│   ├── web/              — Next.js web app
│   └── mobile/           — Expo (React Native) mobile app
├── packages/
│   └── shared/           — Shared types, constants, utilities (@karakas/shared)
├── package.json          — Root workspace config
└── CLAUDE.md
```

## Commands

All commands can be run from the repo root (they proxy to the correct workspace):

```bash
# Web Development
npm run dev           # Start web dev server at http://localhost:3000
npm run build         # Runs prisma generate && next build
npm run start         # Run production server
npm run lint          # Run ESLint

# Mobile Development
npm run mobile        # Start Expo dev server
npm run mobile:ios    # Start Expo for iOS
npm run mobile:android # Start Expo for Android

# Database (runs in apps/web context)
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

# Run a single test file (from apps/web/)
npx vitest run src/path/to/test.test.ts
```

## Web App Architecture (apps/web/)

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

**Structure:**
- `apps/web/src/app/` - Next.js App Router pages and layouts
- `apps/web/src/app/**/actions.ts` - Server Actions for form submissions and mutations
- `apps/web/src/components/` - Shared React components (Header, CommanderImage, CardAutocomplete)
- `apps/web/src/lib/` - Shared utilities (db client, auth, session, scryfall, oauth, password-reset)
- `apps/web/src/types/` - TypeScript type definitions (re-exports from @karakas/shared)
- `apps/web/src/generated/prisma/` - Generated Prisma client (gitignored)
- `apps/web/prisma/` - Database schema and migrations
- `@/*` path alias maps to `./src/*` (within apps/web)

**Database:** Turso (libsql) with Prisma 7 ORM via `@prisma/adapter-libsql`. Singleton client in `apps/web/src/lib/db.ts`.

**Key Models:**
- User, OAuthAccount, PasswordResetToken - Authentication
- Playgroup, PlaygroupMember, PlaygroupPlayer - Group management (PlaygroupPlayer = non-registered players who can be claimed/linked)
- PlaygroupInvitation, PlaygroupPlayerClaimToken - Invitation and claiming flows
- Deck, PlaygroupPlayerDeck - Deck management (with commander1, commander2, bracket fields)
- Game, GamePlayer, PowerPlay - Game tracking
- Friendship - Friend requests with pending/accepted/declined status

**Key patterns:**
- Server Components by default (no `'use client'` unless needed)
- Server Actions in `actions.ts` files use `"use server"` directive, return `{ success: true, ... } | { error: string }`
- Tailwind for all styling with dark mode (zinc/amber palette)
- Cookie-based sessions via `src/lib/session.ts` — plain userId in httpOnly cookie, 7-day expiry, no DB session table
- Use `getCurrentUser()` from `src/lib/auth.ts` for auth checks in server components/actions
- No middleware — all auth checks happen in server components and server actions
- Scryfall API integration in `src/lib/scryfall.ts` with 5-minute in-memory cache

## Mobile App Architecture (apps/mobile/)

**Stack:** Expo SDK 54 + React Native + TypeScript + Expo Router

**Primary feature:** Life counter for MTG games that syncs results to the server.

## Shared Package (packages/shared/)

**Purpose:** Types, constants, and utilities shared between web and mobile apps.
- MTG formats, brackets, power play types (`@karakas/shared`)
- AI event types (SuggestedEvent, ExtractionContext)
- Game constants (starting life totals, commander damage threshold, poison threshold)
- Import as `@karakas/shared` from either app

**MTG Types:** See `packages/shared/src/types/mtg.ts` for formats, brackets, power play types, and game constants.

## Authentication

**Password auth:** bcryptjs (12 rounds) via `apps/web/src/lib/auth.ts`

**OAuth:** Google, Discord, Apple via Arctic library (`apps/web/src/lib/oauth.ts`). All providers are optional — configured only when env vars are present.
- Flow: `GET /auth/[provider]` → OAuth provider → `GET /auth/[provider]/callback` → `findOrCreateUser()` → session
- Google/Discord use PKCE; Apple decodes JWT from ID token
- OAuth links to existing users by email if account doesn't exist yet

**Password reset:** Token-based via `apps/web/src/lib/password-reset.ts`, sends emails with Resend. In dev mode without `RESEND_API_KEY`, logs reset URL to console.

## API Routes

- `GET /api/cards/autocomplete?q=&commander=true` — Card search via Scryfall (optional commander-only filter)
- `GET /api/decks/[id]` — Deck details
- `GET /api/playgroups/[id]` — Playgroup details

## Environment Variables

Stored in `apps/web/.env` and `apps/web/.env.local`:

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
- `apps/web/src/__tests__/` - Unit tests for lib utilities
- `apps/web/src/app/*/__tests__/` - Integration tests for routes/actions
- `apps/web/src/components/__tests__/` - Component tests
- `apps/web/tests/e2e/` - End-to-end tests

**Running tests:**
- Always run `npm run test` before committing
- Run `npm run test:e2e` for full user flow validation

**TypeScript:** Strict mode enabled. Target ES2017.
