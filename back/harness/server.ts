import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, connect } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { backDir, backEntryPoint } from './back';

export interface ServerOptions {
  databaseUrl: string;
  jwtAccessSecret: string;
  /** The indices the dice draw, in order (`DICE_SCRIPT`). Random dice when absent. */
  diceScript?: readonly number[];
}

const BOOT_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;

/** A build of Goodlock-back running as a Node process of its own. */
export class ServerProcess {
  private output = '';

  private constructor(
    private readonly child: ChildProcess,
    readonly port: number,
  ) {
    child.stdout?.on('data', (chunk: Buffer) => (this.output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (this.output += chunk.toString()));
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /** Starts the server and resolves once it accepts connections. */
  static async start(options: ServerOptions): Promise<ServerProcess> {
    const port = await freePort();
    const child = spawn(process.execPath, [backEntryPoint], {
      cwd: backDir,
      env: serverEnv(options, port),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const server = new ServerProcess(child, port);
    try {
      await server.waitUntilAccepting();
    } catch (error) {
      await server.stop();
      throw error;
    }
    return server;
  }

  /** What the server printed, to explain a failure. */
  logs(): string {
    return this.output;
  }

  /** Sends SIGTERM and waits for the exit; SIGKILL if the process outlives the timeout. */
  async stop(): Promise<void> {
    if (this.hasExited()) return;
    const exited = once(this.child, 'exit');
    this.child.kill('SIGTERM');
    const stopped = await Promise.race([exited.then(() => true), sleep(STOP_TIMEOUT_MS).then(() => false)]);
    if (!stopped) {
      this.child.kill('SIGKILL');
      await exited;
    }
  }

  private hasExited(): boolean {
    return this.child.exitCode !== null || this.child.signalCode !== null;
  }

  private async waitUntilAccepting(): Promise<void> {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.hasExited()) {
        throw new Error(`Goodlock-back exited during boot (code ${this.child.exitCode}):\n${this.output}`);
      }
      if (await acceptsConnections(this.port)) return;
      await sleep(100);
    }
    throw new Error(`Goodlock-back did not accept connections within ${BOOT_TIMEOUT_MS} ms:\n${this.output}`);
  }
}

/**
 * The whole environment of the server, built from scratch so nothing leaks from the caller's.
 * The back may load a `.env` from its checkout, which never overrides a variable already set:
 * every variable of its `.env.example` is therefore set here, empty when the scenario leaves it unset.
 */
function serverEnv(options: ServerOptions, port: number): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    NO_COLOR: '1',
    PORT: String(port),
    DATABASE_URL: options.databaseUrl,
    POSTGRES_DB: '',
    POSTGRES_USER: '',
    POSTGRES_PASSWORD: '',
    JWT_ACCESS_SECRET: options.jwtAccessSecret,
    JWT_ACCESS_EXPIRES_IN: '15m',
    CORS_ORIGIN: '',
    DICE_SEED: '',
    DICE_SCRIPT: options.diceScript?.join(',') ?? '',
  };
}

async function freePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  probe.close();
  if (address === null || typeof address === 'string') throw new Error('No free port');
  return address.port;
}

function acceptsConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}
