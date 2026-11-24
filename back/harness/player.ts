import { io, Socket } from 'socket.io-client';
import { Account } from './accounts';
import { ClientEvents, socketAuth } from './contract';
import { contractViolation, ServerEvent, ServerEvents } from './protocol';

export interface ReceivedEvent {
  event: string;
  payload: unknown;
}

interface Waiter {
  matches(received: ReceivedEvent): boolean;
  resolve(received: ReceivedEvent): void;
}

const WAIT_TIMEOUT_MS = 5_000;

/**
 * A player connected over socket.io with their account. Records every event the server sends them,
 * in order, and checks each one against protocol.schema.json.
 */
export class Player {
  /** Every event received, in order. */
  readonly received: ReceivedEvent[] = [];
  /** The events that break protocol.schema.json; a scenario fails on close when there is one. */
  readonly violations: string[] = [];
  private readonly waiters = new Set<Waiter>();
  private sessionIdValue: string | undefined;

  private constructor(
    readonly account: Account,
    private readonly socket: Socket,
  ) {
    socket.onAny((event: string, payload: unknown) => this.record({ event, payload }));
  }

  /** The session the server opened for this connection (`sessionStarted`). */
  get sessionId(): string {
    if (this.sessionIdValue === undefined) throw new Error('No sessionStarted received');
    return this.sessionIdValue;
  }

  /** Connects with the account's token and resolves once the server has started the session. */
  static async connect(serverUrl: string, account: Account): Promise<Player> {
    const socket = io(serverUrl, {
      auth: socketAuth(account.accessToken),
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      autoConnect: false,
    });
    const player = new Player(account, socket);
    const refused = new Promise<never>((_, reject) => {
      socket.once('connect_error', (error) => reject(new Error(`Connection refused: ${error.message}`)));
      socket.once('disconnect', (reason) => reject(new Error(`Disconnected before sessionStarted: ${reason}`)));
    });
    socket.connect();
    const started = await Promise.race([player.waitFor('sessionStarted'), refused]);
    player.sessionIdValue = started.sessionId;
    return player;
  }

  emit<E extends keyof ClientEvents>(event: E, payload: ClientEvents[E]): void {
    this.socket.emit(event, payload);
  }

  /** The payloads of `event` received so far, in order. */
  all<E extends ServerEvent>(event: E): ServerEvents[E][] {
    return this.received.filter((r) => r.event === event).map((r) => r.payload as ServerEvents[E]);
  }

  /**
   * The first `event` received, since the connection, whose payload satisfies `where`;
   * waits for it when none has arrived yet.
   */
  waitFor<E extends ServerEvent>(
    event: E,
    where: (payload: ServerEvents[E]) => boolean = () => true,
    timeoutMs = WAIT_TIMEOUT_MS,
  ): Promise<ServerEvents[E]> {
    const matches = (r: ReceivedEvent): boolean => r.event === event && where(r.payload as ServerEvents[E]);
    const already = this.received.find(matches);
    if (already !== undefined) return Promise.resolve(already.payload as ServerEvents[E]);
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        matches,
        resolve: (r) => {
          clearTimeout(timer);
          this.waiters.delete(waiter);
          resolve(r.payload as ServerEvents[E]);
        },
      };
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`No matching \`${event}\` within ${timeoutMs} ms; received: ${this.receivedNames()}`));
      }, timeoutMs);
      this.waiters.add(waiter);
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  private record(received: ReceivedEvent): void {
    this.received.push(received);
    const violation = contractViolation(received.event, received.payload);
    if (violation !== undefined) this.violations.push(violation);
    for (const waiter of [...this.waiters]) {
      if (waiter.matches(received)) waiter.resolve(received);
    }
  }

  private receivedNames(): string {
    return this.received.map((r) => r.event).join(', ') || 'nothing';
  }
}
