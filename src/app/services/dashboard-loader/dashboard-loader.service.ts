import { Injectable } from '@angular/core';
import { AnalyticsService } from '../analytics/analytics.service';
import { forkJoin, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardLoaderService {

  constructor(
    private analytics: AnalyticsService
  ) {}

  loadDashboard(siteId: string, siteName: string, selectedDate: Date = new Date()): Observable<any> {
    const payload = this.createPayload(siteId, selectedDate);

    return forkJoin({
      siteInfo: of({ siteId, name: siteName }),
      footfall: this.analytics.getFootfall(payload),
      dwell: this.analytics.getDwellTime(payload),
      occupancy: this.analytics.getOccupancyHistory(payload),
      demographics: this.analytics.getDemographics(payload)
    });

  }

  private createPayload(siteId: string, selectedDate: Date) {
    const now = Date.now();
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    const fromUtc = new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0, 0).getTime();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const isToday = fromUtc === todayStart;
    const toUtc = isToday ? now : new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999).getTime();

    return {
      siteId: siteId,
      fromUtc: fromUtc, 
      toUtc: toUtc
    };
  }
}