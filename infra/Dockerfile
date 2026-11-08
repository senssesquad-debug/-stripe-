# passtra — one image: API + admin panel + web build of the app (+ worker via a different CMD).
# Build:  docker build -f infra/Dockerfile -t passtra .
# Run:    docker run -e DATABASE_URL=... -p 8080:8080 passtra                  (API, app at /, admin at /admin/)
#         docker run -e DATABASE_URL=... passtra node dist/worker.js           (dedicated worker)
#         or set RUN_WORKER=true to run the background loop inside the API process (single instance).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @passtra/api... --filter @passtra/admin... --filter @passtra/mobile...
RUN pnpm --filter @passtra/api build && pnpm --filter @passtra/admin build
RUN cd apps/mobile && EXPO_PUBLIC_API_URL=same-origin npx expo export --platform web --output-dir dist
RUN pnpm deploy --filter @passtra/api --prod --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production TZ=UTC PORT=8080 ADMIN_STATIC_DIR=/app/admin APP_STATIC_DIR=/app/web
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/migrations ./migrations
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/admin/dist ./admin
COPY --from=build /repo/apps/mobile/dist ./web
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
