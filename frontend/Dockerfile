# Stage 1: Build
FROM node:18-slim as build-stage

WORKDIR /app

# Optimization for npm in Docker
ENV NPM_CONFIG_LOGLEVEL=info
ENV NPM_CONFIG_PROGRESS=false

# Use a mirror for faster downloads in Russia
RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
# Optimized install: no audit, no fund, increased timeout
RUN npm install --verbose --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
