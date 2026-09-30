KIGALI TASTE — cPanel upload
============================

Two zip files:

  kigali-taste-frontend.zip  →  public_html  (kigalitaste.co)
  kigali-taste-backend.zip   →  Node.js app  (backend.kigalitaste.co)

FRONTEND
  Unzip and upload everything into public_html.
  Show hidden files and keep .htaccess + proxy.php.
  Do not force HTTPS if some phones have no SSL.

BACKEND
  Unzip into the Node app folder.
  Startup file = app.cjs
  Run NPM Install, then Restart.
  Keep your current .env (MySQL + mail secrets).

After both are uploaded, open kigalitaste.co on a phone and confirm
the home page, a restaurant, and login load.
