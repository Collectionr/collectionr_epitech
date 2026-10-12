const { execSync } = require('node:child_process');

const DEFAULT_URL = 'postgresql://collectionr:collectionr@localhost:5432/collectionr_test';

/** Applies every migration to the dedicated integration database before the suites start. */
module.exports = async function globalSetup() {
  const url = process.env.INTEGRATION_DATABASE_URL ?? DEFAULT_URL;
  if (/\/collectionr(\?|$)/.test(url)) {
    throw new Error(
      'INTEGRATION_DATABASE_URL points at the development database; use a dedicated database (e.g. collectionr_test).',
    );
  }
  process.env.INTEGRATION_DATABASE_URL = url;

  try {
    execSync('npx prisma migrate deploy', {
      cwd: __dirname,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    const detail = error.stderr?.toString() || error.stdout?.toString() || String(error);
    throw new Error(`Could not migrate the integration database (${url}):\n${detail}`);
  }
};
