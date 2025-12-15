import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Service to handle cleanup operations across the application
 * Particularly useful for cleaning up subscriptions on logout
 */
@Injectable({
  providedIn: 'root'
})
export class CleanupService {
  
  // Observable that components can subscribe to for logout cleanup
  private logoutSubject = new Subject<void>();
  public onLogout$ = this.logoutSubject.asObservable();

  constructor() {}

  /**
   * Trigger logout cleanup across all components
   */
  triggerLogout() {
    console.log('Triggering application-wide logout cleanup');
    this.logoutSubject.next();
  }
}
