import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CleanupService {
  private logoutSubject = new Subject<void>();
  public onLogout$ = this.logoutSubject.asObservable();
  constructor() {}
  triggerLogout() {
    console.log('Triggering application-wide logout cleanup');
    this.logoutSubject.next();
  }
}
