'use strict';

const COMMIT_TYPES = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'style', 'perf', 'build', 'ci', 'revert'];
const EXEMPT_BRANCHES = ['main', 'dev'];

module.exports = { COMMIT_TYPES, EXEMPT_BRANCHES };
