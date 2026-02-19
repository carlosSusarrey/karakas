# Karakas

Karakas is an MTG (Magic: The Gathering) game tracking web application. Players can log games, manage decks, organize playgroups, and view statistics about their matches and metagame.

## Features

- **Game Logging** — Record game results including player placements, commanders used, turn counts, and notable power plays
- **Deck Management** — Track your decks across formats (Commander, Standard, Modern, Legacy, Pioneer, etc.) with commander and bracket info
- **Playgroups** — Create and manage playgroups with registered users and guest players, invite members, and track group-specific stats
- **Statistics** — View win rates, format breakdowns, and performance trends for players, decks, and playgroups
- **Friends** — Add friends and view their profiles and game history
- **Authentication** — Email/password signup with optional OAuth via Google, Discord, and Apple
- **Card Integration** — Autocomplete and card images powered by the Scryfall API

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript (strict mode) |
| UI | React 19 + [Tailwind CSS 4](https://tailwindcss.com/) |
| Database | SQLite via [Turso](https://turso.tech/) (libSQL) |
| ORM | [Prisma 7](https://www.prisma.io/) |
| Auth | Cookie-based sessions, OAuth via [Arctic](https://arcticjs.dev/) |
| Email | [Resend](https://resend.com/) (password reset emails) |
| Testing | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- A **Turso** database (or any libSQL-compatible endpoint for local dev)

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/carlosSusarrey/karakas.git
cd karakas
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```bash
# Required — Database
TURSO_DATABASE_URL="http://127.0.0.1:8080"   # Local Turso/libSQL URL
TURSO_AUTH_TOKEN=""                            # Auth token (empty for local dev)

# Optional — OAuth (leave unset to disable a provider)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
APPLE_CLIENT_ID=""
APPLE_TEAM_ID=""
APPLE_KEY_ID=""
APPLE_PRIVATE_KEY=""

# Optional — Email (password reset emails log to console if unset)
RESEND_API_KEY=""

# Optional — App URL (defaults to http://localhost:3000)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> OAuth providers are optional. If their env vars are not set, those login options are simply hidden. Password reset emails will log to the console when `RESEND_API_KEY` is not configured.

### 4. Set up the database

Generate the Prisma client and push the schema to your database:

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
```

For iterative schema changes during development, use migrations:

```bash
npm run db:migrate     # Create and apply a migration
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

```bash
# Development
npm run dev             # Start dev server (http://localhost:3000)
npm run build           # Production build (runs prisma generate first)
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema to database (no migration history)
npm run db:migrate      # Create and run migrations
npm run db:studio       # Open Prisma Studio GUI

# Testing
npm run test            # Run unit/integration tests (Vitest)
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
npm run test:e2e        # Run Playwright end-to-end tests
npm run test:e2e:ui     # Run E2E tests with Playwright UI

# Run a single test file
npx vitest run src/path/to/test.test.ts
```

## Project Structure

```
karakas/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration history
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # Home page
│   │   ├── login/             # Login page
│   │   ├── signup/            # Signup page
│   │   ├── decks/             # Deck CRUD pages
│   │   ├── games/             # Game logging and detail pages
│   │   ├── playgroups/        # Playgroup management
│   │   ├── friends/           # Friends list and profiles
│   │   ├── stats/             # Statistics dashboard
│   │   ├── claim/             # Player claim flow
│   │   └── api/               # API routes (card autocomplete, etc.)
│   ├── components/            # Shared React components
│   ├── lib/                   # Utilities (db, auth, session, scryfall, oauth, email)
│   ├── types/                 # TypeScript type definitions (MTG formats, power plays)
│   └── __tests__/             # Unit tests
├── tests/
│   └── e2e/                   # Playwright end-to-end tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── CLAUDE.md                  # AI assistant instructions
```

## Key Concepts

### Database Models

- **User / Session / OAuthAccount** — Authentication and user identity
- **Playgroup / PlaygroupMember / PlaygroupPlayer** — Group management; `PlaygroupPlayer` represents non-registered players that can later be claimed by a real user
- **Deck / PlaygroupPlayerDeck** — Deck tracking with commander, format, and bracket fields
- **Game / GamePlayer / PowerPlay** — Game results with per-player placements, commanders used, and notable plays
- **Friendship** — Friend requests between registered users

### Architecture Patterns

- **Server Components by default** — Only use `'use client'` when client interactivity is required
- **Server Actions** — Mutations live in `actions.ts` files with the `"use server"` directive and return `{ success: true, ... } | { error: string }`
- **Cookie-based sessions** — Managed via `src/lib/session.ts`; use `getCurrentUser()` from `src/lib/auth.ts` for auth checks
- **Path alias** — `@/*` maps to `./src/*`

## Contributing

### Branching

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass before opening a PR

### Code Style

- TypeScript strict mode is enforced
- Use Tailwind CSS for all styling (dark mode uses a zinc/amber palette)
- Follow the existing Server Component / Server Action patterns
- Keep components as Server Components unless client-side interactivity is needed

### Testing Requirements

Run the full test suite before submitting a pull request:

```bash
npm run test            # Unit and integration tests must pass
npm run lint            # No lint errors
npm run build           # Build must succeed
npm run test:e2e        # E2E tests should pass
```

### Adding a New Feature

1. **Schema changes** — Edit `prisma/schema.prisma`, then run `npm run db:migrate`
2. **Server Actions** — Add to or create an `actions.ts` file in the relevant `src/app/` directory
3. **Pages** — Create new route directories under `src/app/` following the App Router conventions
4. **Shared logic** — Place reusable utilities in `src/lib/` and shared components in `src/components/`
5. **Types** — Add MTG-related type definitions to `src/types/mtg.ts`
6. **Tests** — Add unit tests in `src/__tests__/` or co-located `__tests__/` directories; add E2E tests in `tests/e2e/`

## License

This project is private.
