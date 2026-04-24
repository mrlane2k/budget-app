import { spawn } from "node:child_process";

const mode = process.argv[2] === "desktop" ? "desktop" : "web";

const env = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: "3000",
};

if (mode === "desktop") {
  env.DESKTOP_SHELL = "1";
  env.NEXT_PUBLIC_DESKTOP_TRANSPORT = "tauri";
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    stdio: "inherit",
    env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
