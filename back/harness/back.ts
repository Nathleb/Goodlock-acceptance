import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

/**
 * The checkout of Goodlock-back under test: `GOODLOCK_BACK_DIR`, or the sibling `Goodlock-back`.
 * The harness uses only its build (`dist/`), its migrations and its `protocol/protocol.schema.json`.
 */
export const backDir = path.resolve(
  process.env.GOODLOCK_BACK_DIR ?? path.join(__dirname, '..', '..', '..', 'Goodlock-back'),
);

export const backEntryPoint = path.join(backDir, 'dist', 'src', 'main.js');
export const protocolSchemaPath = path.join(backDir, 'protocol', 'protocol.schema.json');
export const prismaSchemaPath = path.join(backDir, 'prisma', 'schema.prisma');
export const prismaCli = path.join(backDir, 'node_modules', '.bin', 'prisma');

export function assertBackIsBuilt(): void {
  if (!existsSync(backEntryPoint)) {
    throw new Error(`No build of Goodlock-back at ${backEntryPoint}: run \`npm run build\` in ${backDir}.`);
  }
}

/**
 * An environment built from scratch for a process run in the back's checkout, so nothing leaks from the
 * caller's. The back may load its `.env`, which never overrides a variable already set: every key of its
 * `.env.example` and `.env` is therefore set, blank unless `variables` gives it a value.
 */
export function isolatedEnv(variables: Record<string, string>): NodeJS.ProcessEnv {
  const keys = ['.env.example', '.env']
    .map((file) => path.join(backDir, file))
    .filter((file) => existsSync(file))
    .flatMap((file) => Object.keys(parse(readFileSync(file))));
  return { ...Object.fromEntries(keys.map((key) => [key, ''])), PATH: process.env.PATH, ...variables };
}
