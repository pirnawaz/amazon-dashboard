FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
EXPOSE 5175

# Vite dev server; Caddy will proxy /api to backend
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
