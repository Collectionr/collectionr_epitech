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
    `Invalid branch name: "${branch}"\n` +
      `Expected format: COLLR-xxx/type/description, e.g. "COLLR-591/feat/hooks-husky"\n` +
      `Allowed types: ${COMMIT_TYPES.join(', ')}`,
  );
  process.exit(1);
}

process.exit(0);
