import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["server/marketDataServer.mjs"], {
    stdio: "inherit"
  }),
  spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite"], {
    stdio: "inherit"
  })
];

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code || signal)) {
      shutdown(code ?? 1);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
