KIGALI TASTE — cPanel upload
============================

Two zip files. Unzip them so files sit at the folder root
(not inside an extra nested folder).

  kigali-taste-frontend.zip  →  public_html of kigalitaste.co
  kigali-taste-backend.zip   →  Node.js app folder of backend.kigalitaste.co

Upload FRONTEND first, then BACKEND, then restart Node.


FRONTEND  (kigalitaste.co → public_html)
---------------------------------------
1. In cPanel File Manager, open public_html.
   Enable “Show hidden files”.
2. Upload kigali-taste-frontend.zip and Extract here.
   public_html must contain (same level, not in a subfolder):
     index.html
     assets/
     .htaccess
     proxy.php
     CPANEL-README.txt
3. Overwrite old index.html and the old assets/ folder.
4. Do not force HTTPS Redirect in cPanel if some phones fail SSL.


BACKEND  (backend.kigalitaste.co → Node.js App)
----------------------------------------------
1. Unzip kigali-taste-backend.zip into the Node app directory.
   You should see app.cjs, package.json, src/, .env.example
2. Keep your existing .env  (MySQL + mail secrets).
   Do not replace it with .env.example.
3. cPanel → Setup Node.js App
     Node version: 20 or newer
     Application startup file: app.cjs
4. Run NPM Install, then Restart.
5. Make the uploads folder writable (chmod 755 or 775).
   Do not delete existing files in uploads — those are the photos
   added from Admin / Vendor panels.


After upload
------------
Open http://kigalitaste.co (or https) on a phone.
Home, a restaurant, and login should load.
Photos use /uploads/... on this same site (proxy.php).
Broken old links like https://uploads/file.jpg are rewritten
to /uploads/file.jpg automatically.
