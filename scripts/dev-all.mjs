import { spawn } from "node:child_process";

const BACKEND_URL = "http://127.0.0.1:5050/api/health";
const children = [];

async function waitForBackend(maxMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(BACKEND_URL);
      if (res.ok) return;
    } catch {
      /* backend still starting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Backend did not become ready on http://127.0.0.1:5050 — check MySQL is running.");
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env, CI: "true" },
  });
  child.on("exit", (code) => {
    if (code) {
      console.error(`\n${name} exited with code ${code ?? 1}`);
      for (const other of children) {
        if (other !== child && !other.killed) other.kill("SIGTERM");
      }
      process.exit(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

console.log("Starting backend API on :5050…");
start("backend", "pnpm", ["--filter", "@workspace/backend", "run", "dev"], { PORT: "5050" });

try {
  await waitForBackend();
  console.log("Backend ready. Starting customer site on :5173…");
} catch (err) {
  console.error((err as Error).message);
  for (const child of children) child.kill("SIGTERM");
  process.exit(1);
}

start("frontend", "pnpm", ["--filter", "@workspace/mockup-sandbox", "run", "dev"], {
  PORT: "5173",
  BASE_PATH: "/",
});

process.on("SIGINT", () => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
});
