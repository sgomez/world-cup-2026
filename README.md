# World Cup 2026

Bet tracker for the 2026 World Cup. Sign in with Google, place predictions, and compete with friends.

## Prerequisites

- Node.js 20+
- pnpm 11+
- PostgreSQL

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create `.env.development`

Copy `.env` and fill in your values:

```bash
cp .env .env.development
```

Then edit `.env.development`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret ≥32 chars — run `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` for local dev |
| `GOOGLE_CLIENT_ID` | From [Google Cloud Console](https://console.cloud.google.com/) |
| `GOOGLE_CLIENT_SECRET` | From [Google Cloud Console](https://console.cloud.google.com/) |

**Google OAuth setup:**
1. Create a project in Google Cloud Console
2. Enable the **Google+ API** (or **Google Identity**)
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### 3. Set up the database

```bash
pnpm db:push
```

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production setup

`.env.production` is committed to the repo **encrypted** via [dotenvx](https://dotenvx.com/).

### First-time setup

```bash
# Create and populate .env.production (gitignored while unencrypted)
cp .env .env.production
# Edit .env.production with real production values, then encrypt:
pnpm env:encrypt
# Now .env.production is safe to commit
git add .env.production
```

The private key is stored in `.env.keys` — **never commit this file** (it is gitignored).

### Decrypting locally

```bash
pnpm env:decrypt
```

**Google OAuth for production:** add `https://yourdomain.com/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint with Biome |
| `pnpm typecheck` | Type check |
| `pnpm db:push` | Push schema to DB |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm env:encrypt` | Encrypt `.env.production` |
| `pnpm env:decrypt` | Decrypt `.env.production` |
