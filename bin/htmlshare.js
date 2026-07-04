#!/usr/bin/env node

const [, , command] = process.argv;

if (command === "--version" || command === "-v") {
  console.log("htmlshare 0.0.0");
  process.exit(0);
}

if (command === "--help" || command === "-h" || !command) {
  console.log("htmlshare");
  console.log("");
  console.log("Usage:");
  console.log("  htmlshare --help");
  console.log("  htmlshare --version");
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
process.exit(1);
