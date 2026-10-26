# Single app image: Hono API + built React UI (served as static files from the API).
# Postgres runs as a separate container — see deploy/docker-compose.yml.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY . .
# Clerk publishable key is baked into the web build (it is public, not a secret).
# Passed by the deploy workflow; an empty value builds the no-login local-mode UI.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build -w web && cp -r web/dist api/public

WORKDIR /app/api
ENV API_PORT=3001
EXPOSE 3001
# NODE_ENV stays unset here; the compose file sets NODE_ENV=production together with
# AUTH_MODE=clerk (the code refuses AUTH_MODE=local under NODE_ENV=production).
CMD ["npx", "tsx", "src/start.ts"]
