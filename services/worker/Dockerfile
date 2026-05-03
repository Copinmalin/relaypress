FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/worker/package.json services/worker/package.json
RUN pnpm install --filter @relaypress/worker... --frozen-lockfile=false

FROM deps AS build
COPY packages/shared packages/shared
COPY services/worker services/worker
RUN pnpm --filter @relaypress/shared build
RUN pnpm --filter @relaypress/worker build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/services/worker/package.json ./services/worker/package.json
COPY --from=build /app/services/worker/dist ./services/worker/dist
CMD ["node", "services/worker/dist/index.js"]
