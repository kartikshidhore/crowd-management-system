import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiteService } from '../../services/site/site.service';
import { AuthService } from '../../services/auth/auth.service';
import { AlertsService } from '../../services/alerts/alerts.service';
import { SocketService } from '../../services/socket.service';
import { Site } from '../../models/site.model';
import { Subscription } from 'rxjs';

// Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
    MatFormFieldModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  sites: Site[] = [];
  selectedSiteId: string = '';
  userEmail: string = '';
  userInitial: string = 'U';
  unseenAlertsCount = 0;
  
  private siteSub?: Subscription;
  private alertsSub?: Subscription;
  private socketSub?: Subscription;

  constructor(
    private siteService: SiteService,
    private authService: AuthService,
    private alertsService: AlertsService,
    private socketService: SocketService
  ) {}

  ngOnInit() {

    const email = this.authService.getEmail();
    if (email) {
      this.userEmail = email;
      this.userInitial = email.charAt(0).toUpperCase();
    }
    this.siteService.loadSites().subscribe((sites) => {
      this.sites = sites;
    });
    this.siteSub = this.siteService.currentSite$.subscribe(site => {
      if (site) {
        this.selectedSiteId = site.siteId;
      }
    });
    this.alertsSub = this.alertsService.unseenCount$.subscribe(count => {
      this.unseenAlertsCount = count;
    });
    this.socketSub = this.socketService.getAlerts().subscribe((data: any) => {
      if (data) {
        this.alertsService.addAlert({
          id: data.id || Date.now().toString(),
          personName: data.personName || data.name || 'Unknown',
          zoneName: data.zoneName || data.zone || 'Unknown Zone',
          severity: data.severity || 'medium',
          timestamp: data.timestamp || Date.now(),
          action: data.action || 'Entered',
          seen: false
        });
      }
    });
  }

  onSiteChange(siteId: string) {
    this.siteService.selectSite(siteId);
  }

  toggleAlerts() {
    this.alertsService.toggleSidebar();
  }

  ngOnDestroy() {
    if (this.siteSub) this.siteSub.unsubscribe();
    if (this.alertsSub) this.alertsSub.unsubscribe();
    if (this.socketSub) this.socketSub.unsubscribe();
  }
}
