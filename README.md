# Kigali Taste

Food delivery platform for Kigali (FRw). Customers order from local restaurants; vendors manage kitchens; admin controls the platform.

## URLs

- Site: https://kigalitaste.co
- API: https://backend.kigalitaste.co

## Local development

Requires **pnpm** and Node 20+.

```bash
pnpm install
pnpm dev
```

- API: http://localhost:5050
- Site: http://localhost:5173

Copy `backend/.env.example` to `backend/.env` and set MySQL plus other secrets.

## Layout

- `artifacts/mockup-sandbox` — Vite/React frontend
- `backend` — Express + MySQL API
- `deploy` — cPanel zip packages
