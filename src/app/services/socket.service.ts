import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  
  // 1. Keep URL empty to use localhost:4200 (which hits your Proxy)
  private url = ''; 

  constructor() {
    this.socket = io(this.url, { 
      // 2. CRITICAL: Explicitly define the path to match your proxy.conf.json
      path: '/socket.io',
      
      // 3. CRITICAL: Allow polling first! This fixes "connection interrupted" errors
      transports: ['polling', 'websocket'], 
      
      autoConnect: true,
      
      // 4. Pass auth token for backend authentication
      auth: { token: localStorage.getItem('auth_token') } 
    });

    this.socket.on("connect_error", (err) => {
      console.error("Socket Connection Error:", err.message);
    });
  }

  getLiveOccupancyUpdates(): Observable<any> {
    return new Observable(observer => {
      // Remove any existing listeners to prevent duplicates
      this.socket.off('live_occupancy');
      
      this.socket.on('live_occupancy', (data) => {
        observer.next(data);
      });
      
      // Cleanup on unsubscribe
      return () => {
        this.socket.off('live_occupancy');
      };
    });
  }

  getAlerts(): Observable<any> {
    return new Observable(observer => {
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
      // Update auth token before reconnecting
      this.socket.auth = { token: localStorage.getItem('auth_token') };
      this.socket.connect();
    }
  }

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }
}