# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karakas is an MTG (Magic: The Gathering) game tracking website where users can log games, manage decks, and view statistics about their playgroup.

## Commands

```bash
# Development
npm run dev           # Start development server at http://localhost:3000
npm run build         # Create production build
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
- `src/lib/` - Shared utilities (db client, auth, session, scryfall)
- `src/types/` - TypeScript type definitions (MTG formats, power plays)
- `src/generated/prisma/` - Generated Prisma client (gitignored)
- `prisma/` - Database schema and migrations
- `@/*` path alias maps to `./src/*`

**Database:** SQLite with Prisma 7 ORM

**Key Models:**
- User, Session, OAuthAccount - Authentication
- Playgroup, PlaygroupMember, PlaygroupPlayer - Group management (PlaygroupPlayer = non-registered players)
- Deck, PlaygroupPlayerDeck - Deck management (with commander1, commander2, bracket fields)
- Game, GamePlayer, PowerPlay - Game tracking

**Key patterns:**
- Server Components by default (no 'use client' unless needed)
- Server Actions in `actions.ts` files use `"use server"` directive, return `{ success: true, ... } | { error: string }`
- Tailwind for all styling with dark mode (zinc/amber palette)
- Cookie-based sessions via `src/lib/session.ts`
- Use `getCurrentUser()` from `src/lib/auth.ts` for auth checks
- Scryfall API integration in `src/lib/scryfall.ts` for card images and autocomplete

**TypeScript:** Strict mode enabled. Target ES2017.

**MTG Types:** See `src/types/mtg.ts` for formats, brackets, and power play types.

## Testing

**Framework:** Vitest (unit/integration) + Playwright (E2E)

**Test structure:**
- `src/__tests__/` - Unit tests for lib utilities
- `src/app/*/__tests__/` - Integration tests for routes/actions
- `tests/e2e/` - End-to-end tests

**Running tests:**
- Always run `npm run test` before committing
- Run `npm run test:e2e` for full user flow validation
