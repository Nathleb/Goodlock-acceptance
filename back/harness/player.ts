import { io, Socket } from 'socket.io-client';
import { Account } from './accounts';
import { ClientEvents, socketAuth } from './contract';
import { contractViolation, ServerEvent, ServerEvents } from './protocol';

export interface ReceivedEvent {
  event: string;
  payload: unknown;
}

interface Waiter {
  event: string;
  /** Settles the waiter if `index` is its event; true once settled. */
  offer(index: number): boolean;
  cancel(reason: string): void;
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
  /** Per event, the index in `received` from which `next` looks. */
  private readonly cursors = new Map<string, number>();
  private sessionIdValue: string | undefined;

  private constructor(
    readonly account: Account,
    private readonly socket: Socket,
  ) {
    socket.onAny((event: string, payload: unknown) => this.record({ event, payload }));
  }

  /** The session the server opened for this connection (`sessionStarted`, see contract.ts). */
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
    const started = await Promise.race([player.next('sessionStarted'), refused]);
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
   * The next `event` whose payload satisfies `where`, waiting for it if it has not arrived yet.
   * Each event is returned once: the next call for the same event looks only after the one returned,
   * and the events of that name passed over on the way are not looked at again.
   */
  next<E extends ServerEvent>(
    event: E,
    where: (payload: ServerEvents[E]) => boolean = () => true,
    timeoutMs = WAIT_TIMEOUT_MS,
  ): Promise<ServerEvents[E]> {
    return new Promise((resolve, reject) => {
      const settle = (outcome: () => void): true => {
        clearTimeout(timer);
        this.waiters.delete(waiter);
        outcome();
        return true;
      };
      const waiter: Waiter = {
        event,
        offer: (index) => {
          const payload = this.received[index].payload as ServerEvents[E];
          this.cursors.set(event, index + 1);
          let matches: boolean;
          try {
            matches = where(payload);
          } catch (error) {
            return settle(() => reject(error));
          }
          return matches && settle(() => resolve(payload));
        },
        cancel: (reason) => settle(() => reject(new Error(`No matching \`${event}\`: ${reason}`))),
      };
      const timer = setTimeout(
        () => waiter.cancel(`none within ${timeoutMs} ms; received: ${this.receivedNames()}`),
        timeoutMs,
      );
      this.waiters.add(waiter);
      for (let index = this.cursors.get(event) ?? 0; index < this.received.length; index++) {
        if (this.received[index].event === event && waiter.offer(index)) return;
      }
    });
  }

  /** Disconnects, and fails every `next` still waiting. */
  disconnect(): void {
    this.socket.disconnect();
    for (const waiter of [...this.waiters]) waiter.cancel('the player disconnected');
  }

  private record(received: ReceivedEvent): void {
    const index = this.received.push(received) - 1;
    const violation = contractViolation(received.event, received.payload);
    if (violation !== undefined) this.violations.push(violation);
    for (const waiter of [...this.waiters]) {
      if (waiter.event === received.event && waiter.offer(index)) return;
    }
  }

  private receivedNames(): string {
    return this.received.map((r) => r.event).join(', ') || 'nothing';
  }
}
