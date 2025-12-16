import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, retry, delay, timeout, catchError, distinctUntilChanged } from 'rxjs/operators';
import { Site } from '../../models/site.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SiteService {
  private apiUrl = `${environment.apiUrl}/sites`;
  private readonly CACHE_KEY = 'cached_sites_list';
  private readonly CACHE_TIMESTAMP_KEY = 'cached_sites_timestamp';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Observable that all components can subscribe to
  private currentSiteSubject = new BehaviorSubject<Site | null>(null);
  public currentSite$ = this.currentSiteSubject.asObservable().pipe(
    distinctUntilChanged((prev, curr) => prev?.siteId === curr?.siteId)
  );
  
  // List of all available sites
  public sites: Site[] = [];

  constructor(private http: HttpClient) {}

  // Load all sites from API and set Dubai Mall as default (with localStorage cache)
  loadSites(): Observable<Site[]> {
    // Check cache first
    const cachedSites = this.getCachedSites();
    if (cachedSites) {
      this.sites = cachedSites;
      // Set first site as default if no site is selected
      if (cachedSites.length > 0 && !this.currentSiteSubject.value) {
        this.selectSite(cachedSites[0].siteId);
      }
      return of(cachedSites);
    }

    // Cache miss or expired - fetch from API
    return this.http.get<Site[]>(this.apiUrl).pipe(
      timeout(10000),
      retry({
        count: 3,
        delay: (error, retryCount) => {
          return of(error).pipe(delay(1000 * Math.pow(2, retryCount - 1)));
        }
      }),
      tap((sites: Site[]) => {
        this.sites = sites;
        // Cache the sites list in localStorage
        this.cacheSites(sites);
        // Set first site (Dubai Mall) as default if no site is selected
        if (sites.length > 0 && !this.currentSiteSubject.value) {
          this.selectSite(sites[0].siteId);
        }
      }),
      catchError((error) => {
        console.error('Failed to load sites after retries:', error);
        return of([]);
      })
    );
  }

  // Get cached sites if valid (not expired)
  private getCachedSites(): Site[] | null {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(this.CACHE_TIMESTAMP_KEY);
      
      if (!cachedData || !cachedTimestamp) {
        return null;
      }

      const timestamp = parseInt(cachedTimestamp, 10);
      const now = Date.now();
      
      // Check if cache is still valid (within TTL)
      if (now - timestamp < this.CACHE_TTL) {
        const sites: Site[] = JSON.parse(cachedData);
        return sites;
      }

      // Cache expired
      return null;
    } catch (error) {
      console.error('Error reading cached sites:', error);
      return null;
    }
  }

  // Cache sites list in localStorage
  private cacheSites(sites: Site[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(sites));
      localStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error caching sites:', error);
    }
  }

  // Clear sites cache (called on logout)
  clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error clearing sites cache:', error);
    }
  }

  // Change the current site
  selectSite(siteId: string): void {
    const site = this.sites.find(s => s.siteId === siteId);
    if (site) {
      this.currentSiteSubject.next(site);
    }
  }

  // Get current site value (non-observable)
  getCurrentSite(): Site | null {
    return this.currentSiteSubject.value;
  }
}
