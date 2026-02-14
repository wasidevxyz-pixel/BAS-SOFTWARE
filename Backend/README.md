# Sales Project Windsurf - Backend

This document explains how to run and deploy the Backend on Heroku.

Required environment variables (see `.env.example`):
- `PORT` (optional)
- `NODE_ENV` (production)
- `MONGO_URI`
- `CORS_ORIGIN`
- `JWT_SECRET`
- `JWT_EXPIRE`
- `RATE_LIMIT_MAX` (optional)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (optional for init scripts)

Local run:

```bash
npm install
cp .env.example .env
# edit .env
npm start
```

Deploy to Heroku:

```bash
heroku create your-app-name
heroku config:set MONGO_URI="<your-mongo-uri>" JWT_SECRET="<secret>" CORS_ORIGIN="https://your-domain"
git push heroku main
heroku logs --tail
```
