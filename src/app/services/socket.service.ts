import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  
  // Keep URL empty to use localhost:4200 (which hits your Proxy)
  private url = ''; 

  constructor() {
    this.socket = io(this.url, { 
      // CRITICAL - Explicitly define the path to match your proxy.conf.json
      path: '/socket.io',
      
      // CRITICAL: Allow polling first! This fixes "connection interrupted" errors
      transports: ['polling', 'websocket'], 
      
      autoConnect: true,
      
      // Pass auth token for backend authentication
      auth: { token: localStorage.getItem('auth_token') } 
    });

    // DEBUGGING: See what is actually happening in the console
    this.socket.on("connect", () => {
      console.log("✅ Socket Connected! ID:", this.socket.id);
    });
    
    this.socket.on("connect_error", (err) => {
      console.error("❌ Socket Connection Error:", err.message);
    });
    
    this.socket.on("disconnect", (reason) => {
      console.log("--- Socket Disconnected:", reason);
    });

    // CATCH ALL EVENTS to see what backend actually sends
    this.socket.onAny((eventName, ...args) => {
      console.log(`Socket Event Received: "${eventName}"`, args);
    });
  }

  getLiveOccupancyUpdates(): Observable<any> {
    return new Observable(observer => {
      // Remove any existing listeners to prevent duplicates
      this.socket.off('live_occupancy');
      
      this.socket.on('live_occupancy', (data) => {
        console.log("⚡ Live occupancy data received:", data);
        observer.next(data);
      });
      
      // Cleanup on unsubscribe
      return () => {
        console.log('Cleaning up live_occupancy listener');
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
      console.log('Disconnecting socket...');
      this.socket.disconnect();
    }
  }

  connect() {
    if (this.socket) {
      console.log('Reconnecting socket with new auth token...');
      // Update auth token before reconnecting
      this.socket.auth = { token: localStorage.getItem('auth_token') };
      this.socket.connect();
    }
  }

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }
}