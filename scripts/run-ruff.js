#!/usr/bin/env node
'use strict';

// Runs ruff for the microservices/tcg/ pre-commit hook: the one of its virtualenv if it exists,
// otherwise the one on the PATH.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENV = path.join(__dirname, '..', 'microservices', 'tcg', '.venv');
const CANDIDATES = [
  path.join(VENV, 'Scripts', 'ruff.exe'), // Windows
  path.join(VENV, 'bin', 'ruff'), // Linux / macOS
];

const ruff = CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? 'ruff';
const result = spawnSync(ruff, process.argv.slice(2), { stdio: 'inherit' });

if (result.error) {
  console.error(
    'ruff not found: create the microservices/tcg/ virtualenv first (see microservices/tcg/README.md, "Installation").',
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
