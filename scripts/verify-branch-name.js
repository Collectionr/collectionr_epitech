#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const { COMMIT_TYPES, EXEMPT_BRANCHES } = require('./constants');

const BRANCH_PATTERN = new RegExp(`^COLLR-\\d+/(${COMMIT_TYPES.join('|')})/[\\w-]+$`);

const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

if (EXEMPT_BRANCHES.includes(branch) || branch === 'HEAD') {
  process.exit(0);
}

if (!BRANCH_PATTERN.test(branch)) {
  console.error(
    `Nom de branche invalide : "${branch}"\n` +
      `Format attendu : COLLR-xxx/type/description, ex. "COLLR-591/feat/hooks-husky"\n` +
      `Types autorisés : ${COMMIT_TYPES.join(', ')}`,
  );
  process.exit(1);
}

process.exit(0);
