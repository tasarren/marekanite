# ─── base ───────────────────────────────────────────────────────────
FROM node:26-slim AS node
RUN npm install -g corepack && corepack enable && corepack use pnpm@latest

FROM node AS base
ARG ANDROID_BUILD_TOOLS_URL=https://dl.google.com/android/repository/build-tools_r34-linux.zip
# platform-tools: adb for Wi-Fi install (pair / connect / install)
ARG ANDROID_PLATFORM_TOOLS_URL=https://dl.google.com/android/repository/platform-tools_r35.0.2-linux.zip
# zip/unzip: APK patch pipeline
# 7z: extract asar from official .dmg / .exe
# curl: healthchecks
# openjdk: runs apksigner
# ca-certificates / wget: fetch Android build-tools
RUN apt update \
  && apt install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    zip \
    wget \
    p7zip-full \
    openjdk-21-jre-headless \
  && rm -rf /var/lib/apt/lists/*

ENV ANDROID_HOME=/opt/android-sdk
ENV BUILD_TOOLS_VERSION="34.0.0"
ENV ANDROID_TOOLS_ROOTDIR="${ANDROID_HOME}/build-tools"
ENV ANDROID_TOOLS_DIR="${ANDROID_TOOLS_ROOTDIR}/android-14"
ENV ANDROID_PLATFORM_DIR="${ANDROID_HOME}/platform-tools"
ENV PATH="${PATH}:${ANDROID_TOOLS_DIR}:${ANDROID_PLATFORM_DIR}"

# Minimal Android build-tools (apksigner + zipalign only stack we need)
# Pin build-tools r34 Linux package from Google.
RUN mkdir -p "${ANDROID_TOOLS_ROOTDIR}" \
  && cd /tmp \
  && wget -q -O build-tools.zip "${ANDROID_BUILD_TOOLS_URL}" \
  && unzip -q build-tools.zip -d "${ANDROID_TOOLS_ROOTDIR}" \
  && rm build-tools.zip \
  && chmod +x "${ANDROID_TOOLS_DIR}/apksigner" \
  && chmod +x "${ANDROID_TOOLS_DIR}/zipalign" \
  && apksigner --version || apksigner version

RUN cd /tmp \
  && wget -q -O platform-tools.zip "${ANDROID_PLATFORM_TOOLS_URL}" \
  && unzip -q platform-tools.zip -d "${ANDROID_HOME}" \
  && rm platform-tools.zip \
  && chmod +x "${ANDROID_PLATFORM_DIR}/adb" \
  && chmod -R a+rX "${ANDROID_HOME}" \
  && adb version

# Persist DB + patch job artifacts here
RUN mkdir -p /data && mkdir -p /app \
    && chown -R node:node /data /app "${ANDROID_HOME}"

USER node
WORKDIR /app

# ─── build ───────────────────────────────────────────────────────────
FROM node AS build
WORKDIR /app

# Workspace manifests first (better layer cache)
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=node:node packages/**/package.json packages/
COPY --chown=node:node tsconfig*.json ./

RUN pnpm install --frozen-lockfile

# Sources
COPY --chown=node:node packages/ packages/

RUN pnpm build

# ─── runtime ─────────────────────────────────────────────────────────
FROM base AS runtime
# App tree (layout must match resolveAdminWebDist: packages/admin-web/dist)
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/tsconfig.base.json ./
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/node_modules ./node_modules

ENV NODE_ENV=production \
    DATABASE_PATH=/data/sync.db \
    LISTEN_HTTP=0.0.0.0:8787 \
    PUBLIC_API_BASE=http://127.0.0.1:8787

EXPOSE 8787

RUN adb version

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/health >/dev/null || exit 1

CMD ["node", "packages/sync-server/dist/index.js"]
