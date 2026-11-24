import { randomBytes } from 'node:crypto';
import { SIGN_UP_PATH, SignUpRequest, SignUpResponse } from './contract';

export interface Account {
  username: string;
  accessToken: string;
}

/** Creates a fresh account through the HTTP auth of the server. */
export async function signUp(serverUrl: string): Promise<Account> {
  const request: SignUpRequest = {
    username: `p${randomBytes(6).toString('hex')}`,
    password: randomBytes(16).toString('hex'),
  };
  const response = await fetch(`${serverUrl}${SIGN_UP_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`POST ${SIGN_UP_PATH} answered ${response.status}: ${body}`);
  const { accessToken } = JSON.parse(body) as Partial<SignUpResponse>;
  if (typeof accessToken !== 'string') throw new Error(`POST ${SIGN_UP_PATH} answered no accessToken: ${body}`);
  return { username: request.username, accessToken };
}
