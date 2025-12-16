import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, retry, delay, timeout, catchError } from 'rxjs/operators';
import { Site } from '../../models/site.model';

@Injectable({
  providedIn: 'root'
})
export class SiteService {
  private apiUrl = '/api/sites';
  
  // Observable that all components can subscribe to
  private currentSiteSubject = new BehaviorSubject<Site | null>(null);
  public currentSite$ = this.currentSiteSubject.asObservable();
  
  // List of all available sites
  public sites: Site[] = [];

  constructor(private http: HttpClient) {}

  // Load all sites from API and set Dubai Mall as default
  loadSites(): Observable<Site[]> {
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
