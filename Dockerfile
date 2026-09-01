FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js ai-routes.js ./
COPY server ./server
COPY shared ./shared
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
