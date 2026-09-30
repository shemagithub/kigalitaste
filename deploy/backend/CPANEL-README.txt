KIGALI TASTE — API (Node.js App)
================================

Upload into the Node app folder for  backend.kigalitaste.co

1. Unzip kigali-taste-backend.zip into the app directory (overwrite src/, app.cjs, package.json)
2. Keep your existing .env  (do not replace it with .env.example)
3. cPanel → Setup Node.js App
     - Node version: 20 or newer
     - Application startup file:  app.cjs
     - Application URL: backend.kigalitaste.co
4. Run NPM Install
5. Restart the app
6. Make sure the  uploads  folder is writable (chmod 755 or 775)

.env must include your MySQL user/password/database.
PUBLIC_APP_URL can be http://kigalitaste.co or https://kigalitaste.co
HTTP is fine — phones without SSL still work through the frontend proxy.

Do not upload node_modules. Let cPanel run NPM Install.
