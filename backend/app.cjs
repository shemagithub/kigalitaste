"use strict";

/**
 * cPanel / LiteSpeed entry point.
 * LiteSpeed require()s this file. We must boot the app via ESM import only
 * (not require("./src/*.ts")), otherwise db.ts loads twice and the pool
 * is undefined during migrations.
 *
 * Setup Node.js App → Application startup file = app.cjs
 */
const path = require("node:path");
const { pathToFileURL } = require("node:url");

require("tsx/esm/api").register();

(async () => {
  const entry = pathToFileURL(path.join(__dirname, "src", "index.ts")).href;
  await import(entry);
})().catch((err) => {
  console.error("Failed to start Kigali Taste API", err);
  process.exit(1);
});

module.exports = {};
