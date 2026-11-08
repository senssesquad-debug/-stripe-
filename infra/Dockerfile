# passtra API + worker + admin panel — one image, two processes (CMD differs).
# Build:  docker build -f infra/Dockerfile -t passtra-api .
# Run:    docker run -e DATABASE_URL=... -p 8080:8080 passtra-api            (API)
#         docker run -e DATABASE_URL=... passtra-api node dist/worker.js     (worker)
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @passtra/api... --filter @passtra/admin...
RUN pnpm --filter @passtra/api build && pnpm --filter @passtra/admin build
RUN pnpm deploy --filter @passtra/api --prod --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production TZ=UTC PORT=8080 ADMIN_STATIC_DIR=/app/admin
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/migrations ./migrations
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/admin/dist ./admin
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
