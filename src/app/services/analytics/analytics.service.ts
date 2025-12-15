import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap, timeout, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  // Relative path so Angular Proxy handles it
  private baseUrl = '/api'; 

  constructor(private http: HttpClient) {}

  // 1. GET Request (No body)
  getSites(): Observable<any> {
    return this.http.get<any[]>(`${this.baseUrl}/sites`);
  }

  // 2. POST Requests (Pass payload to body)
  getFootfall(payload: any): Observable<any> {
    console.log('📡 Calling Footfall API with payload:', payload);
    return this.http.post<any>(`${this.baseUrl}/analytics/footfall`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('XXX Footfall API failed after 3 retries XXX');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          console.log(`--- Footfall API retry ${retryCount}/3 - waiting ${delayMs / 1000}s`);
          return timer(delayMs);
        })
      ))
    );
  }

  getDwellTime(payload: any): Observable<any> {
    console.log('📡 Calling Dwell API with payload:', payload);
    return this.http.post<any>(`${this.baseUrl}/analytics/dwell`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('XXX Dwell API failed after 3 retries XXX');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          console.log(`--- Dwell API retry ${retryCount}/3 - waiting ${delayMs / 1000}s`);
          return timer(delayMs);
        })
      ))
    );
  }

  getOccupancyHistory(payload: any): Observable<any> {
    console.log('📡 Calling Occupancy API with payload:', payload);
    return this.http.post<any>(`${this.baseUrl}/analytics/occupancy`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('XXX Occupancy API failed after 3 retries XXX');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          console.log(`--- Occupancy API retry ${retryCount}/3 - waiting ${delayMs / 1000}s`);
          return timer(delayMs);
        })
      ))
    );
  }

  getDemographics(payload: any): Observable<any> {
    console.log('📡 Calling Demographics API with payload:', payload);
    return this.http.post<any>(`${this.baseUrl}/analytics/demographics`, payload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('XXX Demographics API failed after 3 retries XXX');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          console.log(`--- Demographics API retry ${retryCount}/3 - waiting ${delayMs / 1000}s`);
          return timer(delayMs);
        })
      ))
    );
  }

  getEntryExit(payload: any): Observable<any> {
    console.log('📡 Calling Entry-Exit API with payload:', payload);
    return this.http.post<any>(`${this.baseUrl}/analytics/entry-exit`, payload);
  }

  getEntryExitPaginated(payload: any, pageNumber: number = 1, pageSize: number = 50): Observable<any> {
    const paginatedPayload = {
      ...payload,
      pageNumber,
      pageSize
    };
    console.log('📡 Calling Paginated Entry-Exit API:', paginatedPayload);
    return this.http.post<any>(`${this.baseUrl}/analytics/entry-exit`, paginatedPayload).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 3) {
            console.error('XXX Entry-Exit API failed after 3 retries XXX');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          console.log(`--- Entry-Exit API retry ${retryCount}/3 - waiting ${delayMs / 1000}s`);
          return timer(delayMs);
        })
      ))
    );
  }
}