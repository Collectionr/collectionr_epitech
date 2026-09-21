'use strict';

// The generated Prisma client imports its own internal modules with an explicit
// .js extension on .ts source files (TypeScript NodeNext convention). This
// resolves fine once compiled (nest build) or under Jest (moduleNameMapper in
// jest.config.js), but plain ts-node has no equivalent for ad-hoc scripts like
// this seed script. Patch CommonJS resolution to fall back to the .ts sibling.
const Module = require('module');
const path = require('path');
const fs = require('fs');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilenameWithTsFallback(request, parent, ...rest) {
  if (request.endsWith('.js') && (request.startsWith('./') || request.startsWith('../'))) {
    const basedir = parent && parent.filename ? path.dirname(parent.filename) : process.cwd();
    const tsCandidate = path.resolve(basedir, `${request.slice(0, -'.js'.length)}.ts`);
    if (fs.existsSync(tsCandidate)) {
      return originalResolveFilename.call(
        this,
        `${request.slice(0, -'.js'.length)}.ts`,
        parent,
        ...rest,
      );
    }
  }
  return originalResolveFilename.call(this, request, parent, ...rest);
};
