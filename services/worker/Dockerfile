FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY services/worker/package.json services/worker/package.json
RUN pnpm install --filter @relaypress/worker... --frozen-lockfile

FROM deps AS build
COPY services/worker services/worker
RUN pnpm --filter @relaypress/worker build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/worker/node_modules ./services/worker/node_modules
COPY --from=build /app/services/worker/package.json ./services/worker/package.json
COPY --from=build /app/services/worker/dist ./services/worker/dist
CMD ["node", "services/worker/dist/index.js"]
