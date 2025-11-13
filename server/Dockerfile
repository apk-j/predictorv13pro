# Multi-stage build for server

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Expose port
ENV PORT=8080
EXPOSE 8080

# Recommended to pass env vars at runtime (no .env in image)
CMD ["node", "dist/index.js"]