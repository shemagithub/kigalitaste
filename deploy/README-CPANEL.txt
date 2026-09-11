URLs
----
Frontend: https://kigalitaste.co/          ← upload kigali-taste-frontend.zip to public_html
API:      https://backend.kigalitaste.co/  ← Node app, startup file = app.cjs

1) Fix Node app startup file → app.cjs, Run NPM Install, Restart
2) Upload new frontend zip over public_html (API calls go to backend subdomain)
3) Set .env PUBLIC_APP_URL=https://kigalitaste.co
