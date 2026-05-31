FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY shared/ shared/
COPY bridge/ bridge/
COPY policy/ policy/
COPY command-bus/ command-bus/
COPY evidence/ evidence/
COPY ENGINES/ ENGINES/
COPY vyrden-airoom/ vyrden-airoom/
COPY SZH_CENTRAL_BRAIN/ SZH_CENTRAL_BRAIN/
COPY shell/ shell/
COPY dispatch/ dispatch/
COPY wrappers/ wrappers/
COPY registry/ registry/
COPY terminal/ terminal/
COPY gateway/ gateway/
COPY state/ state/
COPY modules/ modules/
COPY vyrdx-bridge/ vyrdx-bridge/
COPY server/ server/
COPY root.ts ./
RUN npx tsc --noEmit

FROM base AS runtime
RUN groupadd -g 10001 vxstation && useradd -u 10001 -g vxstation -m -s /bin/bash vxstation
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/shared/ ./shared/
COPY --from=build /app/bridge/ ./bridge/
COPY --from=build /app/policy/ ./policy/
COPY --from=build /app/command-bus/ ./command-bus/
COPY --from=build /app/evidence/ ./evidence/
COPY --from=build /app/ENGINES/ ./ENGINES/
COPY --from=build /app/vyrden-airoom/ ./vyrden-airoom/
COPY --from=build /app/SZH_CENTRAL_BRAIN/ ./SZH_CENTRAL_BRAIN/
COPY --from=build /app/shell/ ./shell/
COPY --from=build /app/dispatch/ ./dispatch/
COPY --from=build /app/wrappers/ ./wrappers/
COPY --from=build /app/registry/ ./registry/
COPY --from=build /app/terminal/ ./terminal/
COPY --from=build /app/gateway/ ./gateway/
COPY --from=build /app/state/ ./state/
COPY --from=build /app/modules/ ./modules/
COPY --from=build /app/vyrdx-bridge/ ./vyrdx-bridge/
COPY --from=build /app/server/ ./server/
COPY --from=build /app/root.ts ./

USER vxstation
EXPOSE 7800
ENV NODE_ENV=production
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:7800/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "server/index.ts"]
