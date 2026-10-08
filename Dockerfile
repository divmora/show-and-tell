FROM node:26-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root and package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/react/package.json ./packages/react/
COPY packages/server/package.json ./packages/server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build SDK and Server
RUN pnpm run build && pnpm run build:server

FROM node:26-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root and server manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy compiled assets and demo playground
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY demo ./demo

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
