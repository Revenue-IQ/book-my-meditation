# Single app image: Hono API + built React UI (served as static files from the API).
# Postgres runs as a separate container — see deploy/docker-compose.yml.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY . .
RUN npm run build -w web && cp -r web/dist api/public

WORKDIR /app/api
ENV API_PORT=3001
EXPOSE 3001
# NODE_ENV is deliberately NOT "production": the demo runs in no-login mode
# (AUTH_MODE=local), which the code refuses to start under NODE_ENV=production.
CMD ["npx", "tsx", "src/start.ts"]
