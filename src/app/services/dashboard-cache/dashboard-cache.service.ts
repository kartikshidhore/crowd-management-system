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

interface TrendCache {
  siteId: string;
  date: string; // Yesterday's date key
  footfall: number;
  dwellMinutes: number;
  avgOccupancy: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardCacheService {
  private readonly DASHBOARD_CACHE_KEY = 'dashboard_cache_';
  private readonly TREND_CACHE_KEY = 'trend_cache_';
  private readonly MAX_CACHED_DATES = 7; // Keep last 7 dates
  private readonly TREND_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

  private cacheSubject = new BehaviorSubject<DashboardCache | null>(null);
  public cache$ = this.cacheSubject.asObservable();

  constructor() {}

  /**
   * Store dashboard data in cache (memory + localStorage for historical dates)
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
    
    // Store in memory for current session
    this.cacheSubject.next(cacheData);

    // Store in localStorage
    // Historical dates: permanent (until LRU eviction)
    // Today: 5-minute TTL for faster page navigation
    this.saveDashboardToLocalStorage(siteId, dateKey, cacheData);
  }

  /**
   * Get cached data if valid for current site and date
   */
  getCache(siteId: string, selectedDate: Date): DashboardCache | null {
    const dateKey = this.getDateKey(selectedDate);
    const isTodayDate = this.isToday(selectedDate);
    
    // Check memory cache first
    const cached = this.cacheSubject.value;
    if (cached && cached.siteId === siteId && cached.selectedDate === dateKey) {
      // For today's data, check if cache is still fresh (5 minutes)
      if (isTodayDate) {
        const cacheAge = Date.now() - cached.timestamp;
        const FIVE_MINUTES = 5 * 60 * 1000;
        if (cacheAge > FIVE_MINUTES) {
          return null; // Cache expired, need fresh data
        }
      }
      return cached;
    }

    // Check localStorage cache
    const localStorageCache = this.getDashboardFromLocalStorage(siteId, dateKey);
    if (localStorageCache) {
      // For today's data, check 5-minute TTL
      if (isTodayDate) {
        const cacheAge = Date.now() - localStorageCache.timestamp;
        const FIVE_MINUTES = 5 * 60 * 1000;
        if (cacheAge > FIVE_MINUTES) {
          return null; // Cache expired
        }
      }
      // Load into memory for current session
      this.cacheSubject.next(localStorageCache);
      return localStorageCache;
    }

    return null;
  }

  /**
   * Cache yesterday's trend data with 1-hour TTL
   */
  setTrendCache(siteId: string, yesterdayDate: Date, footfall: number, dwellMinutes: number, avgOccupancy: number): void {
    const dateKey = this.getDateKey(yesterdayDate);
    const trendData: TrendCache = {
      siteId,
      date: dateKey,
      footfall,
      dwellMinutes,
      avgOccupancy,
      timestamp: Date.now()
    };

    try {
      const key = `${this.TREND_CACHE_KEY}${siteId}_${dateKey}`;
      localStorage.setItem(key, JSON.stringify(trendData));
    } catch (error) {
      console.error('Error caching trend data:', error);
    }
  }

  /**
   * Get cached trend data if still valid (within TTL)
   */
  getTrendCache(siteId: string, yesterdayDate: Date): TrendCache | null {
    const dateKey = this.getDateKey(yesterdayDate);
    
    try {
      const key = `${this.TREND_CACHE_KEY}${siteId}_${dateKey}`;
      const cachedData = localStorage.getItem(key);
      
      if (!cachedData) {
        return null;
      }

      const trendCache: TrendCache = JSON.parse(cachedData);
      const now = Date.now();
      
      // Check if cache is still valid (within 1 hour TTL)
      if (now - trendCache.timestamp < this.TREND_TTL) {
        return trendCache;
      }

      // Cache expired
      return null;
    } catch (error) {
      console.error('Error reading trend cache:', error);
      return null;
    }
  }

  /**
   * Save dashboard cache to localStorage
   */
  private saveDashboardToLocalStorage(siteId: string, dateKey: string, data: DashboardCache): void {
    try {
      const key = `${this.DASHBOARD_CACHE_KEY}${siteId}_${dateKey}`;
      localStorage.setItem(key, JSON.stringify(data));
      
      // Implement LRU eviction - keep only last 7 dates
      this.evictOldCaches(siteId);
    } catch (error) {
      console.error('Error saving dashboard to localStorage:', error);
    }
  }

  /**
   * Get dashboard cache from localStorage
   */
  private getDashboardFromLocalStorage(siteId: string, dateKey: string): DashboardCache | null {
    try {
      const key = `${this.DASHBOARD_CACHE_KEY}${siteId}_${dateKey}`;
      const cachedData = localStorage.getItem(key);
      
      if (!cachedData) {
        return null;
      }

      return JSON.parse(cachedData) as DashboardCache;
    } catch (error) {
      console.error('Error reading dashboard from localStorage:', error);
      return null;
    }
  }

  /**
   * Evict old cached dates (keep only last 7 historical dates + today)
   */
  private evictOldCaches(siteId: string): void {
    try {
      const prefix = `${this.DASHBOARD_CACHE_KEY}${siteId}_`;
      const cachedKeys: { key: string; timestamp: number; dateKey: string }[] = [];
      const todayKey = this.getDateKey(new Date());

      // Find all cached keys for this site
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const cachedData = localStorage.getItem(key);
          if (cachedData) {
            const data = JSON.parse(cachedData);
            cachedKeys.push({ key, timestamp: data.timestamp, dateKey: data.selectedDate });
          }
        }
      }

      // Separate today's cache from historical caches
      const historicalCaches = cachedKeys.filter(item => item.dateKey !== todayKey);
      
      // If we have more than MAX_CACHED_DATES historical dates, remove oldest
      if (historicalCaches.length > this.MAX_CACHED_DATES) {
        historicalCaches.sort((a, b) => a.timestamp - b.timestamp);
        const keysToRemove = historicalCaches.slice(0, historicalCaches.length - this.MAX_CACHED_DATES);
        keysToRemove.forEach(item => localStorage.removeItem(item.key));
      }
    } catch (error) {
      console.error('Error evicting old caches:', error);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cacheSubject.next(null);
    
    // Clear all dashboard and trend caches from localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(this.DASHBOARD_CACHE_KEY) || key.startsWith(this.TREND_CACHE_KEY))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Check if cache exists for site and date
   */
  hasCache(siteId: string, selectedDate: Date): boolean {
    return this.getCache(siteId, selectedDate) !== null;
  }

  /**
   * Clear memory cache only (keeps localStorage intact)
   * Used when switching sites to free up memory
   */
  clearMemoryCache(): void {
    this.cacheSubject.next(null);
  }

  /**
   * Check if date is today
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
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
