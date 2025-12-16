import { Injectable } from '@angular/core';
import { AnalyticsService } from '../analytics/analytics.service';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardLoaderService {

  constructor(
    private analytics: AnalyticsService
  ) {}

  loadDashboard(siteId: string, siteName: string, selectedDate: Date = new Date()): Observable<any> {
    // Create the payload (timestamps in MILLISECONDS)
    const payload = this.createPayload(siteId, selectedDate);

    console.log("Loading Dashboard for:", siteName, "Date:", selectedDate.toLocaleDateString(), payload);

    // Fire all API calls in parallel with the correct payload
    return forkJoin({
      siteInfo: of({ siteId, name: siteName }),
          // Use catchError so one failure doesn't break the whole dashboard
          footfall: this.analytics.getFootfall(payload).pipe(
            tap(data => console.log('Footfall API response:', data)),
            catchError(e => {
             console.error('Footfall API failed:', e);
             return of({ footfall: 0 });
          })),
          dwell: this.analytics.getDwellTime(payload).pipe(
            tap(data => console.log('Dwell API response:', data)),
            catchError(e => {
             console.error('Dwell API failed:', e);
             return of({ avgDwellMinutes: 0, dwellRecords: 0 });
          })),
          occupancy: this.analytics.getOccupancyHistory(payload).pipe(
            tap(data => console.log('Occupancy API response:', data)),
            catchError(e => {
             console.error('Occupancy API failed:', e);
             return of({ buckets: [] });
          })),
          demographics: this.analytics.getDemographics(payload).pipe(
            tap(data => console.log('Demographics API response:', data)),
            catchError(e => {
             console.error('Demographics API failed:', e);
             return of({ buckets: [] });
          }))
        });

  }

  private createPayload(siteId: string, selectedDate: Date) {
    // Normalize dates to compare (remove time component)
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    
    const isToday = todayDateOnly.getTime() === selectedDateOnly.getTime();
    
    // Start: Always 00:00:00 of selected date
    const fromUtc = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0).getTime();
    
    // End: Current time if today, 23:59:59 if past date
    let toUtc: number;
    if (isToday) {
      toUtc = today.getTime(); // Current time
      console.log('📅 TODAY: Fetching from 00:00 to NOW');
    } else {
      toUtc = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999).getTime();
      console.log('📅 PAST DATE: Fetching full day 00:00 to 23:59');
    }

    console.log('📅 Date:', selectedDate.toLocaleDateString());
    console.log('📅 From:', new Date(fromUtc).toLocaleString());
    console.log('📅 To:', new Date(toUtc).toLocaleString());
    console.log('📅 Payload:', { siteId, fromUtc, toUtc });

    return {
      siteId: siteId,
      fromUtc: fromUtc, 
      toUtc: toUtc
    };
  }
}