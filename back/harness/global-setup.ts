import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { assertBackIsBuilt, backDir, isolatedEnv, prismaCli, prismaSchemaPath } from './back';
import { DATABASE_URL_VARIABLE } from './database-url';

declare global {
  var acceptancePostgres: StartedPostgreSqlContainer | undefined;
}

/**
 * Starts a disposable Postgres in Docker and applies the migrations of the back under test.
 * The container is removed by the global teardown, or by the testcontainers reaper if the run dies.
 */
export default async function globalSetup(): Promise<void> {
  assertBackIsBuilt();
  const postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = postgres.getConnectionUri();
  try {
    execFileSync(prismaCli, ['migrate', 'deploy', '--schema', prismaSchemaPath], {
      cwd: backDir,
      env: isolatedEnv({ DATABASE_URL: databaseUrl, CHECKPOINT_DISABLE: '1' }),
      stdio: 'pipe',
    });
  } catch (error) {
    // Jest skips the global teardown when the setup fails.
    await postgres.stop();
    throw error;
  }
  globalThis.acceptancePostgres = postgres;
  // Inherited by the Jest workers, forked after the global setup.
  process.env[DATABASE_URL_VARIABLE] = databaseUrl;
}
