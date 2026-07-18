import { io, type Socket } from 'socket.io-client';

import { normalizeBusLocationUpdate } from './api';
import { BASE_URL } from './config';
import type { BusLocationUpdate, SocketConnectionStatus } from '../types';

type BusListener = (bus: BusLocationUpdate) => void;
type StatusListener = (status: SocketConnectionStatus) => void;

export class PassengerSocketService {
  private socket: Socket | null = null;
  private status: SocketConnectionStatus = 'disconnected';
  private busListeners = new Set<BusListener>();
  private statusListeners = new Set<StatusListener>();
  private lastErrorMessage: string | null = null;
  private ownerCount = 0;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    this.ownerCount += 1;

    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }

    if (this.socket?.connected) {
      this.setStatus('connected');
      return;
    }

    if (!this.socket) {
      this.socket = io(BASE_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ['polling'],
        upgrade: false,
      });

      this.bindCoreListeners(this.socket);
    }

    if (this.status === 'connecting' || this.status === 'reconnecting') {
      return;
    }

    this.setStatus('connecting');
    this.socket.connect();
  }

  disconnect() {
    this.ownerCount = Math.max(0, this.ownerCount - 1);

    if (this.ownerCount > 0 || this.releaseTimer) {
      return;
    }

    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;

      if (this.ownerCount > 0) {
        return;
      }

      this.releaseSocket();
    }, 0);
  }

  onBusLocationUpdate(listener: BusListener) {
    this.busListeners.add(listener);

    return () => {
      this.busListeners.delete(listener);
    };
  }

  onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private bindCoreListeners(socket: Socket) {
    socket.on('connect', () => {
      console.log('[PassengerSocket] connected');
      this.lastErrorMessage = null;
      this.setStatus('connected');
    });

    socket.on('disconnect', reason => {
      console.log('[PassengerSocket] disconnected:', reason);
      this.setStatus('disconnected');
    });

    socket.io.on('reconnect_attempt', attempt => {
      if (attempt === 1 || attempt % 5 === 0) {
        console.log('[PassengerSocket] reconnect attempt:', attempt);
      }
      this.setStatus('reconnecting');
    });

    socket.io.on('reconnect', attempt => {
      console.log('[PassengerSocket] reconnected:', attempt);
      this.setStatus('connected');
    });

    socket.io.on('error', error => {
      this.logConnectionError('manager error', error.message);
      this.setStatus('error');
    });

    socket.on('connect_error', error => {
      this.logConnectionError('connect error', error.message);
      this.setStatus('error');
    });

    socket.on('bus_location_update', payload => {
      const bus = normalizeBusLocationUpdate(payload);

      if (!bus) {
        console.log('[PassengerSocket] ignored invalid bus update');
        return;
      }

      this.busListeners.forEach(listener => listener(bus));
    });
  }

  private releaseSocket() {
    if (!this.socket) {
      this.setStatus('disconnected');
      return;
    }

    this.socket.disconnect();
    this.socket.removeAllListeners();
    this.socket.io.removeAllListeners();
    this.socket = null;
    this.setStatus('disconnected');
  }

  private setStatus(status: SocketConnectionStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  private logConnectionError(label: string, message: string) {
    const errorMessage = message || 'unknown error';

    if (this.lastErrorMessage === errorMessage) {
      return;
    }

    this.lastErrorMessage = errorMessage;
    console.log(`[PassengerSocket] ${label}:`, errorMessage);
  }
}

export const passengerSocket = new PassengerSocketService();
