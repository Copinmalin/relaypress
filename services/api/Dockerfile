FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY services/api/package.json services/api/package.json
RUN pnpm install --filter @relaypress/api... --frozen-lockfile

FROM deps AS build
COPY packages/db packages/db
COPY services/api services/api
RUN pnpm --filter @relaypress/db build
RUN pnpm --filter @relaypress/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/services/api/node_modules ./services/api/node_modules
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/services/api/package.json ./services/api/package.json
COPY --from=build /app/services/api/dist ./services/api/dist
EXPOSE 3000
CMD ["node", "services/api/dist/index.js"]
