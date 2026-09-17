import { spawn } from "node:child_process";

const processes = [
  { label: "market-data-server", command: process.execPath, args: ["server/marketDataServer.mjs"] },
  {
    label: "vite",
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["vite"]
  }
];

const children = processes.map(({ label, command, args }) => {
  const child = spawn(command, args, { stdio: "inherit" });
  child.label = label;
  return child;
});

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

  child.on("error", (error) => {
    console.error(`[dev] failed to run "${child.label}":`, error);
    if (!shuttingDown) {
      shutdown(1);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
