import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Alert {
  id: string;
  personName: string;
  zoneName: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: number;
  action: string; 
  seen: boolean;
  isNewest?: boolean; 
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

  addAlert(alert: Alert): void {
    this.alerts.forEach(a => a.isNewest = false);
    alert.isNewest = true;
    this.alerts.unshift(alert);
    this.alertsSubject.next([...this.alerts]);
    this.updateUnseenCount();
  }

  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  markAllAsSeen(): void {
    this.alerts.forEach(alert => alert.seen = true);
    this.alertsSubject.next([...this.alerts]);
    this.updateUnseenCount();
  }

  toggleSidebar(): void {
    const newState = !this.sidebarOpenSubject.value;
    this.sidebarOpenSubject.next(newState);
    if (newState) {
      this.markAllAsSeen();
    }
  }

  closeSidebar(): void {
    this.sidebarOpenSubject.next(false);
  }

  openSidebar(): void {
    this.sidebarOpenSubject.next(true);
    this.markAllAsSeen();
  }

  private updateUnseenCount(): void {
    const unseen = this.alerts.filter(a => !a.seen).length;
    this.unseenCountSubject.next(unseen);
  }

  clearAlerts(): void {
    this.alerts = [];
    this.alertsSubject.next([]);
    this.unseenCountSubject.next(0);
  }
}
