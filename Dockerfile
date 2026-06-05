FROM node:24-alpine AS base
    ENV PNPM_HOME="/pnpm"
    ENV PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
    ENV LEFTHOOK=0
    RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

# ---- deps ----
FROM base AS deps
    RUN apk add --no-cache libc6-compat
    WORKDIR /app
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
    COPY prisma ./prisma
    RUN pnpm install --frozen-lockfile

# ---- builder ----
FROM base AS builder
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    ENV NEXT_TELEMETRY_DISABLED=1
    # Build-time placeholders — real secrets are injected at runtime via dotenvx.
    # These override the encrypted values in .env.production so Next.js static
    # generation doesn't choke on encrypted strings.
    RUN pnpm prisma generate
    RUN pnpm build

# ---- runner ----
FROM base AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1

    RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

    # dotenvx: decrypts .env.production at startup using DOTENV_PRIVATE_KEY_PRODUCTION
RUN pnpm add --global @dotenvx/dotenvx@1.61.1

    COPY --from=builder /app/public ./public
    COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
    COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

    # Encrypted production env — dotenvx decrypts at runtime with DOTENV_PRIVATE_KEY_PRODUCTION
    COPY --chown=nextjs:nodejs .env.production ./

    USER nextjs
    EXPOSE 3000
    ENV PORT=3000
    ENV HOSTNAME="0.0.0.0"

    CMD ["dotenvx", "run", "-f", ".env.production", "--", "node", "server.js"]
