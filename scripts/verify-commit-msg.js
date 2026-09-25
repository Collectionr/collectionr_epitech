#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { COMMIT_TYPES } = require('./constants');

const HEADER_PATTERN = new RegExp(`^(${COMMIT_TYPES.join('|')})(\\([\\w.-]+\\))?: .+$`);
const BYPASS_PATTERN = /^(Merge |Revert ")/;

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error('Usage: verify-commit-msg.js <path-to-message-file>');
  process.exit(1);
}

const rawMessage = fs.readFileSync(commitMsgFile, 'utf8');
const header = rawMessage
  .split('\n')
  .find((line) => line.trim().length > 0 && !line.startsWith('#'));

if (!header) {
  console.error('Empty commit message: it must contain at least one line.');
  process.exit(1);
}

if (BYPASS_PATTERN.test(header)) {
  process.exit(0);
}

if (!HEADER_PATTERN.test(header)) {
  console.error(
    `Invalid commit message: "${header}"\n` +
      `Expected format: "type: description" or "type(scope): description"\n` +
      `Allowed types: ${COMMIT_TYPES.join(', ')}`,
  );
  process.exit(1);
}

process.exit(0);
