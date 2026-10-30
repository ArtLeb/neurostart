FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY tsconfig.json tsconfig.server.json drizzle.config.ts ./
COPY api ./api
COPY contracts ./contracts
COPY db ./db
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/boot.js"]

FROM dependencies AS tools
WORKDIR /app
COPY tsconfig.json tsconfig.server.json drizzle.config.ts ./
COPY api ./api
COPY contracts ./contracts
COPY db ./db
CMD ["npm", "run", "db:push"]
