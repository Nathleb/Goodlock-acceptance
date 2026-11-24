import { randomBytes } from 'node:crypto';
import { signUp } from './accounts';
import { DATABASE_URL_VARIABLE } from './database-url';
import { Player } from './player';
import { ServerProcess } from './server';

export interface ScenarioOptions {
  /** The indices the dice draw, in order (`DICE_SCRIPT`, see contract.ts). Random dice when absent. */
  diceScript?: readonly number[];
}

/** One server of its own, and the players a test signs up on it. */
export class Scenario {
  private readonly players: Player[] = [];

  private constructor(readonly server: ServerProcess) {}

  static async start(options: ScenarioOptions = {}): Promise<Scenario> {
    const databaseUrl = process.env[DATABASE_URL_VARIABLE];
    if (databaseUrl === undefined) throw new Error(`${DATABASE_URL_VARIABLE} is unset: run through jest.config.js`);
    const server = await ServerProcess.start({
      databaseUrl,
      jwtAccessSecret: randomBytes(32).toString('hex'),
      diceScript: options.diceScript,
    });
    return new Scenario(server);
  }

  /** Signs up a fresh account and connects it. */
  async newPlayer(): Promise<Player> {
    const player = await Player.connect(this.server.url, await signUp(this.server.url));
    this.players.push(player);
    return player;
  }

  /** Disconnects every player and stops the server; fails if the server broke protocol.schema.json. */
  async close(): Promise<void> {
    try {
      for (const player of this.players) player.disconnect();
      await this.server.stop();
    } finally {
      const violations = this.players.flatMap((player) => player.violations);
      if (violations.length > 0) {
        // Thrown from finally on purpose: a broken contract outweighs a failed stop().
        throw new Error(`The server broke its contract:\n${violations.join('\n')}\n\nServer logs:\n${this.server.logs()}`);
      }
    }
  }
}
