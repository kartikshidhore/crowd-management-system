import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Alert {
  id: string;
  personName: string;
  zoneName: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: number;
  action: string; // "Entered" or "Exited"
  seen: boolean;
  isNewest?: boolean; // Highlight newest alert
}

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private alerts: Alert[] = [];
  private alertsSubject = new BehaviorSubject<Alert[]>([]);
  private unseenCountSubject = new BehaviorSubject<number>(0);
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);

  public alerts$ = this.alertsSubject.asObservable();
  public unseenCount$ = this.unseenCountSubject.asObservable();
  public sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  constructor() {}

  /**
   * Add new alert from socket
   */
  addAlert(alert: Alert): void {
    // Mark all existing alerts as not newest
    this.alerts.forEach(a => a.isNewest = false);
    
    // Mark new alert as newest
    alert.isNewest = true;
    
    this.alerts.unshift(alert); // Add to beginning
    this.alertsSubject.next([...this.alerts]);
    this.updateUnseenCount();
    console.log('🔔 New alert added:', alert.personName, alert.action);
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Mark all alerts as seen
   */
  markAllAsSeen(): void {
    this.alerts.forEach(alert => alert.seen = true);
    this.alertsSubject.next([...this.alerts]);
    this.updateUnseenCount();
    console.log(' All alerts marked as seen');
  }

  /**
   * Toggle sidebar open/close
   */
  toggleSidebar(): void {
    const newState = !this.sidebarOpenSubject.value;
    this.sidebarOpenSubject.next(newState);
    
    // Mark all as seen when opening
    if (newState) {
      this.markAllAsSeen();
    }
  }

  /**
   * Close sidebar
   */
  closeSidebar(): void {
    this.sidebarOpenSubject.next(false);
  }

  /**
   * Open sidebar
   */
  openSidebar(): void {
    this.sidebarOpenSubject.next(true);
    this.markAllAsSeen();
  }

  /**
   * Update unseen count
   */
  private updateUnseenCount(): void {
    const unseen = this.alerts.filter(a => !a.seen).length;
    this.unseenCountSubject.next(unseen);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    this.alertsSubject.next([]);
    this.unseenCountSubject.next(0);
  }
}
