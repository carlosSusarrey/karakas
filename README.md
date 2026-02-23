# Karakas

An MTG (Magic: The Gathering) game tracking website where users can log games, manage decks, and view statistics about their playgroup.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 (dark mode, zinc/amber palette)
- **Database:** [Turso](https://turso.tech/) (libsql) with Prisma 7 ORM
- **Auth:** Email/password (bcryptjs) + OAuth (Google, Discord, Apple via [Arctic](https://arcticjs.dev/))
- **Email:** [Resend](https://resend.com/) for transactional emails (password resets)
- **Card Data:** [Scryfall API](https://scryfall.com/docs/api) for card images and autocomplete

## Getting Started

### Prerequisites

- Node.js 20+
- A [Turso](https://turso.tech/) database (or compatible libsql instance)

### Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/your-username/karakas.git
   cd karakas
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   # Database (required)
   TURSO_DATABASE_URL="libsql://your-database.turso.io"
   TURSO_AUTH_TOKEN="your-auth-token"

   # App URL (defaults to http://localhost:3000)
   NEXT_PUBLIC_APP_URL="http://localhost:3000"

   # OAuth providers (all optional)
   GOOGLE_CLIENT_ID=""
   GOOGLE_CLIENT_SECRET=""
   DISCORD_CLIENT_ID=""
   DISCORD_CLIENT_SECRET=""
   APPLE_CLIENT_ID=""
   APPLE_TEAM_ID=""
   APPLE_KEY_ID=""
   APPLE_PRIVATE_KEY=""

   # Email (optional — logs to console in dev if missing)
   RESEND_API_KEY=""
   FROM_EMAIL="Karakas <noreply@yourdomain.com>"
   ```

3. Set up the database and generate the Prisma client:

   ```bash
   npm run db:push
   npm run db:generate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client and build for production |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:generate` | Generate Prisma client |
| `npm run test` | Run unit/integration tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI |

## Features

- **Playgroups** — Create and manage play groups with registered users and guest players
- **Deck Management** — Track decks with commander info, format, and EDH bracket (1–4)
- **Game Logging** — Record multiplayer games with placements, eliminations, and turn counts
- **Power Plays** — Tag memorable plays per game (combos, board wipes, theft, etc.)
- **Statistics** — View win rates and play stats across your group
- **Friends** — Send and accept friend requests to connect with other players
- **OAuth Login** — Sign in with Google, Discord, or Apple (when configured)
- **Card Autocomplete** — Search cards with live Scryfall-powered suggestions and art previews
