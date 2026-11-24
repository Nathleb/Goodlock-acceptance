import type { RoomDTO } from './protocol';
import { Scenario } from './scenario';

// Checks the harness itself, end to end; it states no rule.
describe('acceptance harness', () => {
  let scenario: Scenario | undefined;

  beforeEach(async () => {
    scenario = await Scenario.start();
  });

  afterEach(async () => {
    await scenario?.close();
    scenario = undefined;
  });

  it('smoke: two players join a room', async () => {
    const owner = await scenario!.newPlayer();
    const guest = await scenario!.newPlayer();

    owner.emit('createRoom', {});
    const created = await owner.next('roomCreated');
    guest.emit('joinRoom', { roomId: created.roomId });

    const bothSeated = (room: RoomDTO): boolean => room.roomId === created.roomId && room.players.length === 2;
    const both = [owner.sessionId, guest.sessionId].sort();
    for (const player of [owner, guest]) {
      const room = await player.next('roomUpdated', bothSeated);
      expect(room.players.map((p) => p.playerId).sort()).toEqual(both);
      expect(player.all('error')).toEqual([]);
    }
  });
});
