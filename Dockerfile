FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json vitest.config.ts ./
COPY src ./src
COPY fixtures ./fixtures
COPY style-guide.md tiering.yaml ./
COPY drafts/.gitkeep ./drafts/.gitkeep

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
