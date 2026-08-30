FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx vite build

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
