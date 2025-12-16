import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface DashboardCache {
  siteId: string;
  selectedDate: string; // Date as ISO string for comparison
  footfall?: any;
  dwell?: any;
  occupancy?: any;
  demographics?: any;
  timestamp: number; // When this was cached
}

@Injectable({
  providedIn: 'root'
})
export class DashboardCacheService {
  private cacheSubject = new BehaviorSubject<DashboardCache | null>(null);
  public cache$ = this.cacheSubject.asObservable();

  constructor() {}

  /**
   * Store dashboard data in cache
   */
  setCache(siteId: string, selectedDate: Date, data: any): void {
    const dateKey = this.getDateKey(selectedDate);
    const cacheData: DashboardCache = {
      siteId,
      selectedDate: dateKey,
      footfall: data.footfall,
      dwell: data.dwell,
      occupancy: data.occupancy,
      demographics: data.demographics,
      timestamp: Date.now()
    };
    
    this.cacheSubject.next(cacheData);
  }

  /**
   * Get cached data if valid for current site and date
   */
  getCache(siteId: string, selectedDate: Date): DashboardCache | null {
    const cached = this.cacheSubject.value;
    if (!cached) {
      return null;
    }

    const dateKey = this.getDateKey(selectedDate);
    
    // Check if cache matches current site and date
    if (cached.siteId === siteId && cached.selectedDate === dateKey) {
      return cached;
    }

    return null;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cacheSubject.next(null);
  }

  /**
   * Check if cache exists for site and date
   */
  hasCache(siteId: string, selectedDate: Date): boolean {
    return this.getCache(siteId, selectedDate) !== null;
  }

  /**
   * Get normalized date key for comparison (YYYY-MM-DD)
   */
  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
