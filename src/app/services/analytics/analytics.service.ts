import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap, timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  // Relative path so Angular Proxy handles it
  private baseUrl = environment.apiUrl; 

  constructor(private http: HttpClient) {}

  // 1. GET Request (No body)
  getSites(): Observable<any> {
    return this.http.get<any[]>(`${this.baseUrl}/sites`);
  }

  // 2. POST Requests (Pass payload to body)
  getFootfall(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/footfall`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('Footfall API failed after 3 retries');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          return timer(delayMs);
        })
      ))
    );
  }

  getDwellTime(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/dwell`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('Dwell API failed after 3 retries');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          return timer(delayMs);
        })
      ))
    );
  }

  getOccupancyHistory(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/occupancy`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('Occupancy API failed after 3 retries');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          return timer(delayMs);
        })
      ))
    );
  }

  getDemographics(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/analytics/demographics`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('Demographics API failed after 3 retries');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          return timer(delayMs);
        })
      ))
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
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('Entry-Exit API failed after 3 retries');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          return timer(delayMs);
        })
      ))
    );
  }
}