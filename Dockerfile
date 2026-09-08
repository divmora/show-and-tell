FROM node:26-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package*.json ./
COPY packages/sdk/package*.json ./packages/sdk/
COPY packages/server/package*.json ./packages/server/

# Install all dependencies
RUN npm ci

# Copy full source
COPY . .

# Build SDK and Server
RUN npm run build && npm run build:server

FROM node:26-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy root and server manifests
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install production dependencies
RUN npm ci --omit=dev

# Copy compiled assets and demo playground
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY demo ./demo

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
