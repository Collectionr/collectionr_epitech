#!/usr/bin/env node
'use strict';

const fs = require('fs');

const TYPES = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'style', 'perf', 'build', 'ci', 'revert'];

const HEADER_PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([\\w.-]+\\))?: .+$`);
const BYPASS_PATTERN = /^(Merge |Revert ")/;

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error('Usage: verify-commit-msg.js <chemin-du-fichier-de-message>');
  process.exit(1);
}

const rawMessage = fs.readFileSync(commitMsgFile, 'utf8');
const header = rawMessage
  .split('\n')
  .find((line) => line.trim().length > 0 && !line.startsWith('#'));

if (!header) {
  console.error('Commit vide : le message doit contenir au moins une ligne.');
  process.exit(1);
}

if (BYPASS_PATTERN.test(header)) {
  process.exit(0);
}

if (!HEADER_PATTERN.test(header)) {
  console.error(
    `Message de commit invalide : "${header}"\n` +
      `Format attendu : "type: description" ou "type(dossier): description""\n` +
      `Types autorisés : ${TYPES.join(', ')}`,
  );
  process.exit(1);
}

process.exit(0);
