/**
 * The parts of the contract of Goodlock-back that `protocol/protocol.schema.json` does not hold:
 * the schema lists only the events the server sends. The tests name the rest here; every name
 * is a decision the user validates on the pull request that introduces it.
 * Rule IDs cited here are from `Goodlock-specs/META.md`.
 *
 * Running the server (see server.ts): the build is `dist/src/main.js`; it reads `NODE_ENV`, `PORT`,
 * `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` and `DICE_SCRIPT`, and accepts
 * connections once it is ready. `DICE_SCRIPT` imposes the indices the dice draw, comma-separated and
 * in order: a match draws the initiative first (size 2), then once per die rolled (size 6).
 */

/** HTTP: create an account (ACC-1). Answers with an access token for the socket. */
export const SIGN_UP_PATH = '/auth/register';

export interface SignUpRequest {
  username: string;
  password: string;
}

export interface SignUpResponse {
  accessToken: string;
}

/** The socket.io handshake `auth` of an authenticated client. */
export function socketAuth(accessToken: string): Record<string, string> {
  return { token: accessToken };
}

/**
 * Every event a client sends, with its payload. On connection the server sends `sessionStarted`;
 * a player's `playerId` in a room is that `sessionId`.
 */
export interface ClientEvents {
  /** Create a room and sit in it as its owner (ROOM-1, ROOM-2); answered by `roomCreated`. */
  createRoom: Record<string, never>;
  /** Sit in the room `roomId` (ROOM-1); the room's players then receive `roomUpdated`. */
  joinRoom: { roomId: string };
}
