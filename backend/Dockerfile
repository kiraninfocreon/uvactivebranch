# ── Build stage ──────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app

# openssl is required by Prisma's query engine at generate/runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 8080
# Run pending migrations, THEN start — safe to run on every container
# start because `prisma migrate deploy` is a no-op when there's nothing
# new to apply. Never `prisma migrate dev` in this image.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
