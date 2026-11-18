FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm init -y >/dev/null && npm install --no-audit --no-fund marked@16 playwright-core@1 >/dev/null
COPY server.mjs /app/desk.mjs
CMD ["node", "/app/desk.mjs"]
