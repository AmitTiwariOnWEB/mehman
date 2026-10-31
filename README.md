# Mehman Management System

Mehman is a multi-tenant visitor, gate, guard, resident, office, and access management platform.

## Stack

- `backend`: Node.js, Express, Prisma, MySQL, JWT auth, QR pass services.
- `frontend`: React/Vite web dashboard and landing page.
- `mobile`: Expo/React Native Android app for guards, residents, offices, and admins.

## Production Hosting

Use a public HTTPS API URL for both web and APK builds, for example:

```txt
https://api.yourdomain.com/api
```

Hostinger Cloud Startup can host the web build, Node backend, and MySQL database. Copy `backend/.env.hostinger.example` to `backend/.env` on the server and fill in the Hostinger MySQL credentials.

For a new MySQL database:

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run build
npm run seed --workspace backend
```

Seed login:

```txt
superadmin@mehman.example
Mehman@12345
```

## Build URLs

Frontend production env:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

Mobile production env:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
EXPO_PUBLIC_DEMO_MODE=false
```
