FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/api/package.json services/api/package.json
RUN pnpm install --filter @relaypress/api... --frozen-lockfile=false

FROM deps AS build
COPY services/api services/api
RUN pnpm --filter @relaypress/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/api/package.json ./services/api/package.json
COPY --from=build /app/services/api/dist ./services/api/dist
EXPOSE 3000
CMD ["node", "services/api/dist/index.js"]
