# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Karakas is an MTG (Magic: The Gathering) game tracking website where users can log games, manage decks, and view statistics about their playgroup.

## Commands

```bash
npm run dev           # Start development server at http://localhost:3000
npm run build         # Create production build
npm run start         # Run production server
npm run lint          # Run ESLint
npm run db:migrate    # Run Prisma migrations (npx prisma migrate dev)
npm run db:push       # Push schema changes to database (npx prisma db push)
npm run db:studio     # Open Prisma Studio GUI (npx prisma studio)
npm run db:generate   # Generate Prisma client (npx prisma generate)
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

**Structure:**
- `src/app/` - Next.js App Router pages and layouts
- `src/lib/` - Shared utilities (db client, auth, session)
- `src/types/` - TypeScript type definitions (MTG formats, power plays)
- `src/generated/prisma/` - Generated Prisma client (gitignored)
- `prisma/` - Database schema and migrations
- `@/*` path alias maps to `./src/*`

**Database:** SQLite with Prisma 7 ORM

**Models:**
- User - Players with email/password or OAuth
- OAuthAccount - OAuth provider connections
- Session - User sessions
- Deck - User's decks with format, commander, bracket
- Game - Game sessions with format, turns, notes
- GamePlayer - Links players/decks to games with results
- PowerPlay - Notable plays within games

**Key patterns:**
- Server Components by default (no 'use client' unless needed)
- Tailwind for all styling with dark mode (zinc/amber palette)
- Geist Sans/Mono fonts via next/font
- Cookie-based sessions via `src/lib/session.ts`
- Use `getCurrentUser()` from `src/lib/auth.ts` for auth

**TypeScript:** Strict mode enabled. Target ES2017.

**MTG Types:** See `src/types/mtg.ts` for formats, brackets, and power play types.
