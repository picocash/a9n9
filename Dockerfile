# One image for the Node services; the service to run is chosen by the command.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY services/inbox/package.json services/inbox/
COPY services/phone/package.json services/phone/
COPY services/email-worker/package.json services/email-worker/
COPY services/nostr/package.json services/nostr/
COPY services/telegram/package.json services/telegram/
COPY services/web/package.json services/web/
COPY services/anchor/package.json services/anchor/
RUN npm ci --no-audit --no-fund
COPY services/inbox services/inbox
COPY services/phone services/phone
COPY services/nostr services/nostr
COPY services/telegram services/telegram
COPY services/web services/web
COPY services/anchor services/anchor
RUN npm run build -w @a9n9/inbox && npm run build -w @a9n9/phone && npm run build -w @a9n9/nostr && npm run build -w @a9n9/telegram && npm run build -w @a9n9/web && npm run build -w @a9n9/anchor

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/services/inbox/package.json services/inbox/
COPY --from=build /app/services/phone/package.json services/phone/
COPY --from=build /app/services/email-worker/package.json services/email-worker/
COPY --from=build /app/services/nostr/package.json services/nostr/
COPY --from=build /app/services/telegram/package.json services/telegram/
COPY --from=build /app/services/web/package.json services/web/
COPY --from=build /app/services/anchor/package.json services/anchor/
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/services/inbox/dist services/inbox/dist
COPY --from=build /app/services/phone/dist services/phone/dist
COPY --from=build /app/services/nostr/dist services/nostr/dist
COPY --from=build /app/services/telegram/dist services/telegram/dist
COPY --from=build /app/services/web/dist services/web/dist
COPY --from=build /app/services/anchor/dist services/anchor/dist
USER node
