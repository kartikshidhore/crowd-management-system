import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, retryWhen, mergeMap, timeout } from 'rxjs/operators';
import { throwError, timer } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  //proxy path "/api"
  private apiURL = "/api/auth/login";

  constructor(private http : HttpClient, private router : Router) {}

  login(creds: {email: string, password: string}) {
    return this.http.post<{token : string}>(this.apiURL, creds).pipe(
      timeout(10000),
      retryWhen(errors => errors.pipe(
        mergeMap((error, index) => {
          const retryCount = index + 1;
          if (retryCount > 2) {
            console.error('Login failed after 2 retries');
            return throwError(() => error);
          }
          const delayMs = 1000 * Math.pow(2, index);
          return timer(delayMs);
        })
      )),
      tap( response => {
        if(response.token){
          localStorage.setItem('auth_token', response.token);
          // Store email for user profile display
          localStorage.setItem('user_email', creds.email);
        }
      })
    );
  }

  getEmail(): string | null {
    return localStorage.getItem('user_email');
  }

  isLoggedIn() : boolean {
    return !!localStorage.getItem('auth_token');
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    this.router.navigate(['/login']);
  }
}
