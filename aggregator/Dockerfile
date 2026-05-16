# syntax=docker/dockerfile:1.7
#
# Aggregator deploy image. Build from the REPO ROOT so the pnpm
# workspace lockfile and the @notmartin/ffe sdk workspace dep are
# both visible. Example: `docker build -f aggregator/Dockerfile .`
#
# Railway: set "Root Directory" to . (repo root) and "Dockerfile Path"
# to aggregator/Dockerfile.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- deps + build -----
FROM base AS build
WORKDIR /repo

# Copy lockfile + workspace manifests first so pnpm can resolve.
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY package.json ./
COPY sdk/package.json sdk/
COPY aggregator/package.json aggregator/

# Install only the workspaces we actually need for the aggregator.
RUN pnpm install \
    --frozen-lockfile \
    --filter @notmartin/ffe-aggregator... \
    --filter @notmartin/ffe...

# Copy sources for sdk + aggregator and build both.
COPY sdk/ sdk/
COPY aggregator/ aggregator/
RUN pnpm --filter @notmartin/ffe build
RUN pnpm --filter @notmartin/ffe-aggregator build

# ----- runtime -----
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy the entire workspace install + built dist files. Easier than
# pruning when the aggregator imports the workspace sdk at runtime.
COPY --from=build /repo /app

WORKDIR /app/aggregator

# Persistent location for runtime status + cancel-request files.
# Mount a Railway volume here.
ENV FFE_AGGREGATOR_STATUS_PATH=/data/ffe-aggregator-status.json
ENV FFE_AGGREGATOR_CANCEL_PATH=/data/ffe-aggregator-cancellations.json

CMD ["node", "dist/start.js"]
