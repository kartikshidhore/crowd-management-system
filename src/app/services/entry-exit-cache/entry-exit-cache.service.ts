import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable({
  providedIn: 'root'
})
export class EntryExitCacheService {
  private cacheSubject = new BehaviorSubject<any>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  
  public cache$ = this.cacheSubject.asObservable();
  public isLoading$ = this.isLoadingSubject.asObservable();

  constructor(private analyticsService: AnalyticsService) {}

  /**
   * Preload entry-exit data for a site and date (first page only)
   */
  preloadData(siteId: string, selectedDate: Date = new Date()): void {
    if (this.isLoadingSubject.value) {
      console.log(' Already loading entry-exit data, skipping preload');
      return;
    }

    console.log('/// Preloading entry-exit data for siteId:', siteId);
    this.isLoadingSubject.next(true);

    const payload = this.createPayload(siteId, selectedDate);
    
    this.analyticsService.getEntryExitPaginated(payload, 1, 50)
      .pipe(
        tap({
          next: (data) => {
            console.log('✅ Entry-exit data preloaded successfully:', data.totalRecords, 'total records');
            this.cacheSubject.next(data);
            this.isLoadingSubject.next(false);
          },
          error: (err) => {
            console.error('❌ Error preloading entry-exit data:', err);
            this.isLoadingSubject.next(false);
          }
        })
      )
      .subscribe();
  }

  /**
   * Load fresh data with pagination (clears cache and reloads)
   */
  loadData(siteId: string, selectedDate: Date = new Date(), pageNumber: number = 1, pageSize: number = 50): Observable<any> {
    console.log('/// Loading fresh entry-exit data - Page:', pageNumber);
    this.isLoadingSubject.next(true);

    const payload = this.createPayload(siteId, selectedDate);
    
    return this.analyticsService.getEntryExitPaginated(payload, pageNumber, pageSize).pipe(
      tap({
        next: (data) => {
          console.log('✅ Entry-exit data loaded successfully - Page', pageNumber, 'of', data.totalPages);
          // Only cache first page for instant display
          if (pageNumber === 1) {
            this.cacheSubject.next(data);
          }
          this.isLoadingSubject.next(false);
        },
        error: (err) => {
          console.error('❌ Error loading entry-exit data:', err);
          this.isLoadingSubject.next(false);
        }
      })
    );
  }

  /**
   * Get cached data (returns null if not cached)
   */
  getCachedData(): any {
    return this.cacheSubject.value;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    console.log(' Clearing entry-exit cache');
    this.cacheSubject.next(null);
  }

  /**
   * Create API payload with proper timestamp logic
   */
  private createPayload(siteId: string, selectedDate: Date): any {
    const now = new Date();
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const isToday = selectedDateOnly.getTime() === todayDateOnly.getTime();
    
    // Start of selected day (00:00:00.000)
    const midnight = new Date(selectedDateOnly);
    midnight.setHours(0, 0, 0, 0);
    
    // End of selected day (23:59:59.999) or current time if today
    const endOfDay = new Date(selectedDateOnly);
    endOfDay.setHours(23, 59, 59, 999);
    
    const fromUtc = midnight.getTime(); // milliseconds
    const toUtc = isToday ? now.getTime() : endOfDay.getTime(); // milliseconds
    
    console.log('📅 Payload:', {
      siteId,
      fromUtc: new Date(fromUtc).toISOString(),
      toUtc: new Date(toUtc).toISOString(),
      isToday
    });
    
    return { siteId, fromUtc, toUtc };
  }
}
