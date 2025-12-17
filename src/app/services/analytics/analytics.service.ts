import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, timer, of } from 'rxjs';
import { retryWhen, mergeMap, timeout, catchError, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private baseUrl = environment.apiUrl; 

  constructor(private http: HttpClient) {}

  getSites(): Observable<any> {
    return this.http.get<any[]>(`${this.baseUrl}/sites`);
  }

  getFootfall(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/footfall`, payload).pipe(
      timeout(8000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 2) {
            console.error('Footfall API failed after 2 retries');
            return throwError(() => error);
          }
          const delayMs = 500 * Math.pow(2, index);
          return timer(delayMs);
        })
      )),
      catchError(error => {
        console.error('Footfall API error:', error);
        return of({ footfall: 0 });
      }),
      take(1)
    );
  }

  getDwellTime(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/dwell`, payload).pipe(
      timeout(8000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 2) {
            console.error('Dwell API failed after 2 retries');
            return throwError(() => error);
          }
          const delayMs = 500 * Math.pow(2, index);
          return timer(delayMs);
        })
      )),
      catchError(error => {
        console.error('Dwell API error:', error);
        return of({ avgDwellMinutes: 0, dwellRecords: 0 });
      }),
      take(1)
    );
  }

  getOccupancyHistory(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/occupancy`, payload).pipe(
      timeout(8000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 2) {
            console.error('Occupancy API failed after 2 retries');
            return throwError(() => error);
          }
          const delayMs = 500 * Math.pow(2, index);
          return timer(delayMs);
        })
      )),
      catchError(error => {
        console.error('Occupancy API error:', error);
        return of({ buckets: [] });
      }),
      take(1)
    );
  }

  getDemographics(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/demographics`, payload).pipe(
      timeout(8000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 2) {
            console.error('Demographics API failed after 2 retries');
            return throwError(() => error);
          }
          const delayMs = 500 * Math.pow(2, index);
          return timer(delayMs);
        })
      )),
      catchError(error => {
        console.error('Demographics API error:', error);
        return of({ buckets: [] });
      }),
      take(1)
    );
  }

  getEntryExit(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/entry-exit`, payload);
  }

  getEntryExitPaginated(payload: any, pageNumber: number = 1, pageSize: number = 50): Observable<any> {
    const paginatedPayload = {
      ...payload,
      pageNumber,
      pageSize
    };
    return this.http.post<any>(`${this.baseUrl}/analytics/entry-exit`, paginatedPayload).pipe(
      timeout(8000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 2) {
            console.error('Entry-Exit API failed after 2 retries');
            return throwError(() => error);
          }
          const delayMs = 500 * Math.pow(2, index);
          return timer(delayMs);
        })
      )),
      catchError(error => {
        console.error('Entry-Exit API error:', error);
        return of({ records: [], totalRecords: 0, totalPages: 0, pageNumber: 1, pageSize: 50 });
      }),
      take(1)
    );
  }
}