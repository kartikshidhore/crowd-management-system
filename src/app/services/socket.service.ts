import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;

  private url = '';

  constructor() {
    this.socket = io(this.url, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      autoConnect: true,
      auth: { token: localStorage.getItem('auth_token') },
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err.message);
    });
  }
  
  getLiveOccupancyUpdates(): Observable<any> {
    return new Observable((observer) => {
      this.socket.off('live_occupancy');
      this.socket.on('live_occupancy', (data) => {
        observer.next(data);
      });
      return () => {
        this.socket.off('live_occupancy');
      };
    });
  }

  getAlerts(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on('alert', (data) => {
        observer.next(data);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  connect() {
    if (this.socket) {
      this.socket.auth = { token: localStorage.getItem('auth_token') };
      this.socket.connect();
    }
  }

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }
}
