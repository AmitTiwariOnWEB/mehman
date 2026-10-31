# Hostinger Cloud Startup Deployment

This project is prepared for Hostinger Cloud Startup with MySQL.

## Required URLs

- Web app: `https://yourdomain.com`
- API: `https://api.yourdomain.com/api`
- Health check: `https://api.yourdomain.com/health`

The mobile APK and web app must both use the public API URL. Do not build production apps with `localhost` or `192.168.x.x` URLs.

## Backend Environment

Create `backend/.env` from `backend/.env.hostinger.example`:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=mysql://HOSTINGER_DB_USER:HOSTINGER_DB_PASSWORD@HOSTINGER_DB_HOST:3306/HOSTINGER_DB_NAME
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
JWT_REFRESH_SECRET=replace-with-at-least-32-random-characters
QR_SIGNING_SECRET=replace-with-at-least-32-random-characters
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
WEB_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

## First Database Setup

Use `db push` for Hostinger MySQL:

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run seed --workspace backend
```

## Frontend Build

Create `frontend/.env.production`:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

Then build:

```bash
npm run build --workspace frontend
```

Upload or serve `frontend/dist`.

## Backend Build

```bash
npm run build --workspace backend
npm run start --workspace backend
```

If Hostinger asks for a startup file, use:

```txt
backend/dist/server.js
```

## APK Build

Set the production API URL before building. You can either export it in the shell or put it in `mobile/.env` for the release build:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
EXPO_PUBLIC_DEMO_MODE=false
```

Then rebuild the APK. Already-installed APKs keep their old API URL, so reinstall the new APK after changing the production API URL.

For a production-signed Android APK, create `mobile/android/keystore.properties` from `mobile/android/keystore.properties.example` and point it to your upload keystore before running the release build. If that file is missing, Gradle falls back to the debug key for local testing only.
