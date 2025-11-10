# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
# Allow passing API base and feature flags at build time
ARG API_BASE=
ARG VITE_WEB_AUTHN_ENABLED=1
ENV VITE_API_BASE_URL=$API_BASE \
    VITE_WEB_AUTHN_ENABLED=$VITE_WEB_AUTHN_ENABLED
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
