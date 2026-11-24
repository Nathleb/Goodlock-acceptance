/**
 * The parts of the contract of Goodlock-back that `protocol/protocol.schema.json` does not hold:
 * the schema lists only the events the server sends. The tests name the rest here; every name
 * is a decision the user validates on the pull request that introduces it.
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

/** Every event a client sends, with its payload. */
export interface ClientEvents {
  /** Create a room and sit in it as its owner (ROOM-1, ROOM-2); answered by `roomCreated`. */
  createRoom: Record<string, never>;
  /** Sit in the room `roomId` (ROOM-1); the room's players then receive `roomUpdated`. */
  joinRoom: { roomId: string };
}
