#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const packageRoot = path.resolve(__dirname, "..");
const distCli = path.join(packageRoot, "dist", "cli.js");

if (fs.existsSync(distCli)) {
  require(distCli);
} else {
  const tsxCli = path.join(packageRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const srcCli = path.join(packageRoot, "src", "cli.ts");
  const result = spawnSync(
    process.execPath,
    [tsxCli, srcCli, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: packageRoot },
  );
  process.exit(result.status ?? 1);
}
