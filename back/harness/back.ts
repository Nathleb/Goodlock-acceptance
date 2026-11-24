import { existsSync } from 'node:fs';
import path from 'node:path';

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
