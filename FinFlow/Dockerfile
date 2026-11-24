# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
COPY package.json ./
RUN npm install --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server.ts tsconfig.json ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8080
VOLUME ["/data"]
CMD ["npx", "tsx", "server.ts"]
