# Node + ffmpeg (with libass) + the caption font. No browser, no Python.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-inter ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production OUTPUT_DIR=/data/output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY styles ./styles
COPY assets ./assets
# Voice and speech models download on first use into this folder; mount it to keep them.
VOLUME ["/data/output", "/app/node_modules/@huggingface/transformers/.cache"]
EXPOSE 3000
ENTRYPOINT ["node"]
CMD ["dist/main.js"]
