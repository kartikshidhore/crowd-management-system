import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AlertsService, Alert } from '../../services/alerts/alerts.service';

@Component({
  selector: 'app-alerts-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './alerts-sidebar.component.html',
  styleUrl: './alerts-sidebar.component.scss'
})
export class AlertsSidebarComponent implements OnInit, OnDestroy {
  isOpen = false;
  alerts: Alert[] = [];
  
  private sidebarSub?: Subscription;
  private alertsSub?: Subscription;

  constructor(private alertsService: AlertsService) {}

  ngOnInit() {
    this.sidebarSub = this.alertsService.sidebarOpen$.subscribe(open => {
      this.isOpen = open;
    });
    this.alertsSub = this.alertsService.alerts$.subscribe(alerts => {
      this.alerts = alerts;
    });
  }

  closeSidebar() {
    this.alertsService.closeSidebar();
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity.toLowerCase()}`;
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month} ${day} ${year}  ${hours}:${minutes}`;
  }

  ngOnDestroy() {
    if (this.sidebarSub) this.sidebarSub.unsubscribe();
    if (this.alertsSub) this.alertsSub.unsubscribe();
  }
}
