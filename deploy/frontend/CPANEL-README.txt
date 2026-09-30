KIGALI TASTE — FRONTEND (public_html)
=====================================

Upload into:  public_html  of  kigalitaste.co

1. Unzip kigali-taste-frontend.zip
2. Upload ALL files into public_html (overwrite old files)
   You MUST include:
     - index.html
     - assets/              (the new hashed JS/CSS)
     - .htaccess            (hidden file — enable “Show hidden files” in File Manager)
     - proxy.php            (sends /api to the Node app even without SSL)

3. Do not force HTTPS if some phones/networks have no SSL certificate.

How it works
------------
The browser only talks to kigalitaste.co.
proxy.php + .htaccess send /api and /uploads to
http://backend.kigalitaste.co  (HTTP first, then HTTPS with cert checks off).
