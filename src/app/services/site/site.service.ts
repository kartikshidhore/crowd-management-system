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
  private currentSiteSubject = new BehaviorSubject<Site | null>(null);
  public currentSite$ = this.currentSiteSubject.asObservable().pipe(
    distinctUntilChanged((prev, curr) => prev?.siteId === curr?.siteId)
  );
  
  public sites: Site[] = [];
  constructor(private http: HttpClient) {}

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

  selectSite(siteId: string): void {
    const site = this.sites.find(s => s.siteId === siteId);
    if (site) {
      this.currentSiteSubject.next(site);
    }
  }

  getCurrentSite(): Site | null {
    return this.currentSiteSubject.value;
  }
}
