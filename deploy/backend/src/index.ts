import { initDb } from "./db.ts";

async function main() {
  await initDb();

  const { startMailboxSyncLoop } = await import("./mailboxSync.ts");
  startMailboxSyncLoop();

  const { default: app } = await import("./app.ts");
  const port = Number(process.env.PORT || 5050);

  app.listen(port, () => {
    console.log("");
    console.log("Kigali Taste API  http://localhost:" + port);
    console.log("Customer site     http://localhost:5173/");
    console.log("Admin login       http://localhost:5173/admin/login");
    console.log("                  admin@kigalitaste.rw / admin123");
    console.log("Vendor login      http://localhost:5173/vendor/login");
    console.log("                  vendor@kigalitaste.rw / vendor123");
    console.log("Customer login    customer@kigalitaste.rw / customer123");
    console.log("");
  });
}

main().catch((err) => {
  console.error("Failed to start Kigali Taste API", err);
  process.exit(1);
});
