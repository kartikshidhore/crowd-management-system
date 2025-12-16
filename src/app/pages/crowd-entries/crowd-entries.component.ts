import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

// Services
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { SiteService } from '../../services/site/site.service';
import { EntryExitCacheService } from '../../services/entry-exit-cache/entry-exit-cache.service';
import { CleanupService } from '../../services/cleanup/cleanup.service';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';

// Components
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AlertsSidebarComponent } from '../../components/alerts-sidebar/alerts-sidebar.component';

// Material Imports
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
  
  // Date Selection
  selectedDate: Date = new Date();
  maxDate: Date = new Date();
  dateDisplayText: string = 'Today';
  
  // Table Data
  displayedColumns: string[] = ['name', 'sex', 'entry', 'exit', 'dwellTime'];
  allRecords: EntryExitRecord[] = [];
  displayedRecords: EntryExitRecord[] = [];
  
  // Pagination
  pageSize = 50;
  pageIndex = 0;
  totalRecords = 0;
  totalPages = 0;
  isLoading = false; // Loading state for API calls
  
  private siteSub?: Subscription;
  private cacheSub?: Subscription;

  constructor(
    private analyticsService: AnalyticsService,
    private siteService: SiteService,
    private cacheService: EntryExitCacheService,
    private cleanupService: CleanupService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.updateDateDisplayText();
    
    // Subscribe to cached data
    this.cacheSub = this.cacheService.cache$.subscribe(cachedData => {
      if (cachedData) {
        console.log('Using cached entry-exit data');
        this.processEntryExitData(cachedData);
      }
    });
    
    // Subscribe to site changes
    this.siteSub = this.siteService.currentSite$.subscribe(site => {
      if (site) {
        const siteChanged = this.currentSiteId && this.currentSiteId !== site.siteId;
        
        console.log('📍 Site changed to:', site.name);
        this.currentSiteId = site.siteId;
        this.siteName = site.name;
        
        if (siteChanged) {
          // Clear cache when site changes
          console.log('Site changed, clearing cache and loading fresh data');
          this.cacheService.clearCache();
          this.pageIndex = 0;
          this.loadEntryExitData(1);
        } else {
          // Initial load - check for cached data
          const cachedData = this.cacheService.getCachedData();
          if (cachedData && cachedData.siteId === site.siteId) {
            console.log('Found cached data for current site');
            this.processEntryExitData(cachedData);
          } else {
            console.log('📡 No cache, loading fresh data');
            this.loadEntryExitData(1);
          }
        }
      }
    });
  }

  loadEntryExitData(pageNumber: number = 1) {
    console.log('Loading Entry-Exit data - Page:', pageNumber);
    this.isLoading = true;
    
    this.cacheService.loadData(this.currentSiteId, this.selectedDate, pageNumber, this.pageSize).subscribe({
      next: (response) => {
        console.log('Entry-Exit data loaded');
        this.processEntryExitData(response);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Entry-Exit API failed:', err);
        this.allRecords = [];
        this.displayedRecords = [];
        this.totalRecords = 0;
        this.totalPages = 0;
        this.isLoading = false;
      }
    });
  }

  processEntryExitData(response: any) {
    // Process API response and map to table records
    const records = response.records || [];
    
    console.log('📋 API Response:', {
      totalRecords: response.totalRecords,
      totalPages: response.totalPages,
      pageNumber: response.pageNumber,
      pageSize: response.pageSize,
      recordCount: records.length
    });
    console.log('📋 First record sample:', records[0]);
    
    // Map records with correct field names from API
    this.displayedRecords = records.map((record: any) => {
      // Use entryLocal and exitLocal (capital L) from API - format to time only with AM/PM
      const entryTime = this.formatTimeOnly(record.entryLocal || null);
      const exitTime = this.formatTimeOnly(record.exitLocal || null);
      
      // Format dwell time from dwellMinutes to HH:MM format (hours:minutes)
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
    
    // Update pagination from API response
    this.totalRecords = response.totalRecords || 0;
    this.totalPages = response.totalPages || 0;
    this.pageIndex = (response.pageNumber || 1) - 1; // Convert to 0-based
    this.pageSize = response.pageSize || 50;
    
    console.log('Displaying', this.displayedRecords.length, 'records (Page', this.pageIndex + 1, 'of', this.totalPages, ')');
  }

  updateDisplayedRecords() {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedRecords = this.allRecords.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadEntryExitData(event.pageIndex + 1); // API uses 1-based page numbers
  }
  goToPage(pageNumber: number) {
    if (pageNumber >= 0 && pageNumber < this.totalPages) {
      this.pageIndex = pageNumber;
      this.loadEntryExitData(pageNumber + 1); // API uses 1-based page numbers
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
      // Show all pages if total is 7 or less
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(this.totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < this.totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(this.totalPages);
    }
    
    return pages;
  }
  createPayload() {
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedDateOnly = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate());
    
    const isToday = todayDateOnly.getTime() === selectedDateOnly.getTime();
    
    const fromUtc = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate(), 0, 0, 0, 0).getTime();
    
    let toUtc: number;
    if (isToday) {
      toUtc = today.getTime();
    } else {
      toUtc = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate(), 23, 59, 59, 999).getTime();
    }

    return {
      siteId: this.currentSiteId,
      fromUtc: fromUtc,
      toUtc: toUtc
    };
  }

  onDateChange(date: Date | null) {
    if (!date) return;
    
    this.selectedDate = date;
    this.updateDateDisplayText();
    
    console.log('Date changed to:', date.toLocaleDateString());
    
    // Clear cache and reset to first page
    this.cacheService.clearCache();
    this.pageIndex = 0;
    
    if (this.currentSiteId) {
      this.loadEntryExitData(1);
    }
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
    console.log('👋 User logging out from crowd entries');
    // Trigger cleanup across all components
    this.cleanupService.triggerLogout();
    // Call auth service logout
    this.authService.logout();
    // Navigate to login
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
      // Try to parse the time string
      // Expected format from API: "2024-12-15T11:05:00" or similar ISO format
      const date = new Date(timeString);
      
      if (isNaN(date.getTime())) {
        // If parsing fails, return as-is
        return timeString;
      }
      
      // Format as 12-hour time with AM/PM
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12
      const minutesStr = String(minutes).padStart(2, '0');
      
      return `${hours}:${minutesStr} ${ampm}`;
    } catch (e) {
      return timeString;
    }
  }

  formatTimeOnly(timeString: string | null): string {
    if (!timeString || timeString === '--') return '--';
    
    try {
      // Handle format: "14/12/2025 21:43:20" (DD/MM/YYYY HH:MM:SS)
      const parts = timeString.split(' ');
      if (parts.length !== 2) return '--';
      
      const timePart = parts[1]; // "21:43:20"
      const timeComponents = timePart.split(':');
      if (timeComponents.length < 2) return '--';
      
      let hours = parseInt(timeComponents[0], 10);
      const minutes = parseInt(timeComponents[1], 10);
      
      if (isNaN(hours) || isNaN(minutes)) return '--';
      
      // Convert to 12-hour format with AM/PM
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12
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
