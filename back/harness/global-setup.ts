import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { assertBackIsBuilt, backDir, prismaCli, prismaSchemaPath } from './back';
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
  globalThis.acceptancePostgres = postgres;
  const databaseUrl = postgres.getConnectionUri();
  execFileSync(prismaCli, ['migrate', 'deploy', '--schema', prismaSchemaPath], {
    cwd: backDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
  // Inherited by the Jest workers, forked after the global setup.
  process.env[DATABASE_URL_VARIABLE] = databaseUrl;
}
