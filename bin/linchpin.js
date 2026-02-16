#!/usr/bin/env node

const { run } = require('../src/cli');

run(process.argv.slice(2)).catch((error) => {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
