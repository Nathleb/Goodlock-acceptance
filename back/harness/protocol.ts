import { readFileSync } from 'node:fs';
import Ajv, { ValidateFunction } from 'ajv';
import { protocolSchemaPath } from './back';
import type { ProtocolSchema } from './protocol.generated';

export type * from './protocol.generated';

/** Every event the server sends, with its payload, as `protocol.schema.json` states them. */
export type ServerEvents = ProtocolSchema;
export type ServerEvent = keyof ServerEvents;

const SCHEMA_ID = 'protocol';

const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
const schema = JSON.parse(readFileSync(protocolSchemaPath, 'utf8')) as {
  definitions: { ServerEvents: { properties: Record<string, unknown> } };
};
ajv.addSchema(schema, SCHEMA_ID);

const validators = new Map<string, ValidateFunction>();

function validatorFor(event: string): ValidateFunction | undefined {
  if (!Object.hasOwn(schema.definitions.ServerEvents.properties, event)) return undefined;
  let validate = validators.get(event);
  if (validate === undefined) {
    validate = ajv.compile({ $ref: `${SCHEMA_ID}#/definitions/ServerEvents/properties/${event}` });
    validators.set(event, validate);
  }
  return validate;
}

/** Why an event the server sent breaks the schema, or `undefined` when it follows it. */
export function contractViolation(event: string, payload: unknown): string | undefined {
  const validate = validatorFor(event);
  if (validate === undefined) return `\`${event}\` is not an event of protocol.schema.json`;
  if (validate(payload)) return undefined;
  return `\`${event}\` breaks protocol.schema.json: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(payload)}`;
}
