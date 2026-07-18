jest.mock('../src/services/secureSession', () => ({
  getAccessTokenAsync: jest.fn().mockResolvedValue('driver-token'),
}));

import {
  ApiError,
  completeDriverTrip,
  configureUnauthorizedHandler,
  sendDriverLocation,
  startDriverTrip,
} from '../src/services/api';
import type { TripLocation } from '../src/types';

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const location: TripLocation = {
  lat: 6.9271,
  lng: 79.8612,
  speed: 24,
  heading: 90,
  accuracy: 8,
  timestamp: '2026-07-18T10:00:00.000Z',
};

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest
      .fn()
      .mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('Driver API contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureUnauthorizedHandler(null);
  });

  test('posts the canonical GPS payload without driver or bus identity', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        status: 'success',
        bus: {
          bus_id: 'NC-1234',
          routeNumber: '138',
          updatedAt: location.timestamp,
          operationalStatus: 'active',
          isActive: true,
        },
      }),
    );

    await sendDriverLocation(location);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/location$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(location);
    expect(options.headers.Authorization).toBe('Bearer driver-token');
    expect(options.body).not.toContain('driverId');
    expect(options.body).not.toContain('busId');
  });

  test('starts and completes trips through the authoritative lifecycle paths', async () => {
    fetchMock
      .mockResolvedValueOnce(response(201, { status: 'started', trip: {}, bus: {} }))
      .mockResolvedValueOnce(
        response(200, { status: 'completed', trip: {}, bus: {} }),
      );

    await startDriverTrip();
    await completeDriverTrip('trip/unsafe');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/driver\/trips\/start$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    expect(fetchMock.mock.calls[1][0]).toMatch(
      /\/api\/driver\/trips\/trip%2Funsafe\/complete$/,
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({});
  });

  test('notifies auth state on an authenticated 401 response', async () => {
    const unauthorized = jest.fn();
    configureUnauthorizedHandler(unauthorized);
    fetchMock.mockResolvedValue(response(401, { error: 'Token expired' }));

    await expect(sendDriverLocation(location)).rejects.toMatchObject({
      status: 401,
      message: 'Token expired',
    });
    await Promise.resolve();

    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  test('does not expose an HTML response body in user-facing errors', async () => {
    fetchMock.mockResolvedValue(
      response(500, '<html><body>private debug trace</body></html>'),
    );

    const request = sendDriverLocation(location);

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.not.toThrow(/private debug trace/);
  });
});
