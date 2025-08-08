# Build stage
FROM node:23-slim AS build

WORKDIR /app
COPY Frontend/nutrition-frontend/package*.json ./
RUN npm install
COPY Frontend/nutrition-frontend/ .
RUN npm run build

# Serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY Frontend/nutrition-frontend/nginx.conf /etc/nginx/conf.d/default.conf
