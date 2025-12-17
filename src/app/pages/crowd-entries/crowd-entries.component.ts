import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { SiteService } from '../../services/site/site.service';
import { CleanupService } from '../../services/cleanup/cleanup.service';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AlertsSidebarComponent } from '../../components/alerts-sidebar/alerts-sidebar.component';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface EntryExitRecord {
  name: string;
  sex: string;
  entry: string;
  exit: string | null;
  dwellTime: string | null;
  avatar?: string;
}

@Component({
  selector: 'app-crowd-entries',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NavbarComponent,
    AlertsSidebarComponent,
    MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule,
    MatCardModule, MatListModule, MatTableModule, MatPaginatorModule,
    MatDatepickerModule, MatInputModule, MatFormFieldModule, MatNativeDateModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './crowd-entries.component.html',
  styleUrl: './crowd-entries.component.scss'
})
export class CrowdEntriesComponent implements OnInit, OnDestroy {
  
  sidebarOpen = true;
  currentSiteId: string = '';
  siteName = 'Loading...';
  
  selectedDate: Date = new Date();
  maxDate: Date = new Date();
  dateDisplayText: string = 'Today';
  displayedColumns: string[] = ['name', 'sex', 'entry', 'exit', 'dwellTime'];
  allRecords: EntryExitRecord[] = [];
  displayedRecords: EntryExitRecord[] = [];
  
  pageSize = 50;
  pageIndex = 0;
  totalRecords = 0;
  totalPages = 0;
  isLoading = false;
  private siteSub?: Subscription;
  private cacheSub?: Subscription;

  constructor(
    private analyticsService: AnalyticsService,
    private siteService: SiteService,
    private cleanupService: CleanupService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.updateDateDisplayText();
    this.siteSub = this.siteService.currentSite$.subscribe(site => {
      if (site) {
        const siteChanged = this.currentSiteId && this.currentSiteId !== site.siteId;
        
        this.currentSiteId = site.siteId;
        this.siteName = site.name;
        
        if (siteChanged) {
          this.pageIndex = 0;
          this.loadEntryExitData(1);
        } else {
          this.loadEntryExitData(1);
        }
      }
    });
  }

  loadEntryExitData(pageNumber: number = 1) {
    if (!this.currentSiteId) return;
    
    this.isLoading = true;
    this.cdr.detectChanges();
    const now = Date.now();
    const selectedYear = this.selectedDate.getFullYear();
    const selectedMonth = this.selectedDate.getMonth();
    const selectedDay = this.selectedDate.getDate();
    const fromUtc = new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0, 0).getTime();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const isToday = fromUtc === todayStart;
    const toUtc = isToday ? now : new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999).getTime();
    
    const payload = { siteId: this.currentSiteId, fromUtc, toUtc };
    
    this.analyticsService.getEntryExitPaginated(payload, pageNumber, this.pageSize).subscribe({
      next: (response) => {
        this.processEntryExitData(response);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Entry-Exit API failed:', err);
        this.allRecords = [];
        this.displayedRecords = [];
        this.totalRecords = 0;
        this.totalPages = 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  processEntryExitData(response: any) {
    const records = response.records || [];
    this.displayedRecords = records.map((record: any) => {
      const entryTime = this.formatTimeOnly(record.entryLocal || null);
      const exitTime = this.formatTimeOnly(record.exitLocal || null);
      
      let dwellTimeFormatted = '--';
      if (record.dwellMinutes != null && record.dwellMinutes > 0) {
        const hours = Math.floor(record.dwellMinutes / 60);
        const minutes = Math.floor(record.dwellMinutes % 60);
        dwellTimeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
      
      return {
        name: record.personName || 'N/A',
        sex: record.gender || record.sex || '--',
        entry: entryTime,
        exit: exitTime,
        dwellTime: dwellTimeFormatted,
        avatar: record.avatar || undefined
      };
    });
    this.totalRecords = response.totalRecords || 0;
    this.totalPages = response.totalPages || 0;
    this.pageIndex = (response.pageNumber || 1) - 1; 
    this.pageSize = response.pageSize || 50;
  }

  updateDisplayedRecords() {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedRecords = this.allRecords.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadEntryExitData(event.pageIndex + 1); 
  }
  goToPage(pageNumber: number) {
    if (pageNumber >= 0 && pageNumber < this.totalPages) {
      this.pageIndex = pageNumber;
      this.loadEntryExitData(pageNumber + 1);
    }
  }

  handlePageClick(page: number | string) {
    if (typeof page === 'number') {
      this.goToPage(page - 1);
    }
  }

  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    const currentPage = this.pageIndex + 1;
    
    if (this.totalPages <= 7) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(this.totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < this.totalPages - 2) {
        pages.push('...');
      }
      pages.push(this.totalPages);
    }
    
    return pages;
  }
  createPayload(siteId: string, selectedDate: Date, pageNumber: number, pageSize: number) {
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    
    const isToday = todayDateOnly.getTime() === selectedDateOnly.getTime();
    
    const fromUtc = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0).getTime();
    
    let toUtc: number;
    if (isToday) {
      toUtc = today.getTime();
    } else {
      toUtc = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999).getTime();
    }

    return {
      siteId: siteId,
      fromUtc: fromUtc,
      toUtc: toUtc,
      pageNumber: pageNumber,
      pageSize: pageSize
    };
  }

  onDateChange(date: Date | null) {
    if (!date) return;
    
    this.selectedDate = date;
    this.updateDateDisplayText();
    this.pageIndex = 0;
    
    if (this.currentSiteId) {
      this.loadEntryExitData(1);
    }
    this.cdr.detectChanges();
  }

  updateDateDisplayText() {
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const yesterday = new Date(todayDateOnly);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const selected = new Date(this.selectedDate);
    const selectedDateOnly = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    
    if (selectedDateOnly.getTime() === todayDateOnly.getTime()) {
      this.dateDisplayText = 'Today';
    } else if (selectedDateOnly.getTime() === yesterday.getTime()) {
      this.dateDisplayText = 'Yesterday';
    } else {
      this.dateDisplayText = selectedDateOnly.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout(): void {
    this.cleanupService.triggerLogout();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  formatValue(value: string | null): string {
    return value || '--';
  }

  formatSex(sex: string): string {
    if (!sex || sex === '--') return '--';
    const sexLower = sex.toLowerCase();
    if (sexLower === 'male' || sexLower === 'm') return 'Male';
    if (sexLower === 'female' || sexLower === 'f') return 'Female';
    return sex;
  }

  formatTime(timeString: string | null): string {
    if (!timeString || timeString === '--') return '--';
    
    try {
      const date = new Date(timeString);
      
      if (isNaN(date.getTime())) {
        return timeString;
      }
      
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = String(minutes).padStart(2, '0');
      
      return `${hours}:${minutesStr} ${ampm}`;
    } catch (e) {
      return timeString;
    }
  }

  formatTimeOnly(timeString: string | null): string {
    if (!timeString || timeString === '--') return '--';
    
    try {
      const parts = timeString.split(' ');
      if (parts.length !== 2) return '--';
      
      const timePart = parts[1];
      const timeComponents = timePart.split(':');
      if (timeComponents.length < 2) return '--';
      
      let hours = parseInt(timeComponents[0], 10);
      const minutes = parseInt(timeComponents[1], 10);
      
      if (isNaN(hours) || isNaN(minutes)) return '--';
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = String(minutes).padStart(2, '0');
      
      return `${hours}:${minutesStr} ${ampm}`;
    } catch (e) {
      return '--';
    }
  }

  ngOnDestroy() {
    if (this.siteSub) this.siteSub.unsubscribe();
    if (this.cacheSub) this.cacheSub.unsubscribe();
  }
}
