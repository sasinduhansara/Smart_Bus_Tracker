import { io, type Socket } from 'socket.io-client';

import { PassengerSocketService } from '../src/services/socket';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

const mockedIo = jest.mocked(io);

function createSocketDouble() {
  const socketHandlers = new Map<string, (value: unknown) => void>();
  const managerHandlers = new Map<string, (value: unknown) => void>();
  const manager = {
    on: jest.fn((event: string, listener: (value: unknown) => void) => {
      managerHandlers.set(event, listener);
    }),
    removeAllListeners: jest.fn(),
  };
  const socket = {
    connected: false,
    io: manager,
    on: jest.fn((event: string, listener: (value: unknown) => void) => {
      socketHandlers.set(event, listener);
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  return {
    managerHandlers,
    socket: socket as unknown as Socket,
    socketHandlers,
    socketSpies: socket,
  };
}

describe('PassengerSocketService ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shares one socket until the final owner disconnects', () => {
    const socketDouble = createSocketDouble();
    mockedIo.mockReturnValue(socketDouble.socket);
    const service = new PassengerSocketService();

    service.connect();
    service.connect();

    expect(mockedIo).toHaveBeenCalledTimes(1);
    expect(socketDouble.socketSpies.connect).toHaveBeenCalledTimes(1);

    service.disconnect();
    jest.runOnlyPendingTimers();
    expect(socketDouble.socketSpies.disconnect).not.toHaveBeenCalled();

    service.disconnect();
    jest.runOnlyPendingTimers();
    expect(socketDouble.socketSpies.disconnect).toHaveBeenCalledTimes(1);
    expect(
      socketDouble.socketSpies.io.removeAllListeners,
    ).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending release when a new screen acquires the socket', () => {
    const socketDouble = createSocketDouble();
    mockedIo.mockReturnValue(socketDouble.socket);
    const service = new PassengerSocketService();

    service.connect();
    service.disconnect();
    service.connect();
    jest.runOnlyPendingTimers();

    expect(mockedIo).toHaveBeenCalledTimes(1);
    expect(socketDouble.socketSpies.disconnect).not.toHaveBeenCalled();

    service.disconnect();
    jest.runOnlyPendingTimers();
    expect(socketDouble.socketSpies.disconnect).toHaveBeenCalledTimes(1);
  });

  it('delivers a normalized status-only lifecycle event', () => {
    const socketDouble = createSocketDouble();
    mockedIo.mockReturnValue(socketDouble.socket);
    const service = new PassengerSocketService();
    const listener = jest.fn();

    service.onBusLocationUpdate(listener);
    service.connect();
    socketDouble.socketHandlers.get('bus_location_update')?.({
      bus_id: 'WP-NB-1234',
      operationalStatus: 'offline',
      isActive: false,
      statusUpdatedAt: '2026-07-16T12:00:30.000Z',
    });

    expect(listener).toHaveBeenCalledWith({
      bus_id: 'WP-NB-1234',
      operationalStatus: 'offline',
      isActive: false,
      statusUpdatedAt: '2026-07-16T12:00:30.000Z',
    });

    service.disconnect();
  });
});
