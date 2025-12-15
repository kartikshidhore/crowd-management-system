import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';

// Services
import { DashboardLoaderService } from '../../services/dashboard-loader/dashboard-loader.service';
import { SocketService } from '../../services/socket.service';
import { SiteService } from '../../services/site/site.service';
import { EntryExitCacheService } from '../../services/entry-exit-cache/entry-exit-cache.service';
import { DashboardCacheService } from '../../services/dashboard-cache/dashboard-cache.service';
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
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Chart Imports
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

// Register annotation plugin
Chart.register(annotationPlugin);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
    NavbarComponent,
    AlertsSidebarComponent,
    MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule,
    MatCardModule, MatListModule, MatMenuModule,
    MatDatepickerModule, MatInputModule, MatFormFieldModule, MatNativeDateModule,
    MatProgressSpinnerModule,
    BaseChartDirective
  ],
  providers: [
    provideCharts(withDefaultRegisterables())
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  
  // View Variables
  siteName = 'Loading...';
  todaysFootfall = 0;
  avgDwellTime = '--';
  liveOccupancy = 0;
  
  /**
   * TREND CALCULATION SYSTEM
   * 
   * Compares today's metrics with yesterday's to show percentage changes.
   * 
   * OPTIMIZATION FEATURES:
   * - Caching: Yesterday's data cached per date to prevent redundant API calls
   * - Edge Cases: Handles NaN, division by zero, first day, extreme outliers
   * - Performance: Single API call per date, no recalculation on socket updates
   * - Memory: Cache cleared on date change and component destroy
   * 
   * CALCULATION LOGIC:
   * - Footfall: Today's total vs Yesterday's total
   * - Dwell Time: Today's avg vs Yesterday's avg (in minutes)
   * - Occupancy: Today's AVERAGE vs Yesterday's AVERAGE (not live value)
   * 
   * NOTE: Live occupancy updates via socket but trends only calculate once on load.
   * This is intentional - comparing daily averages, not real-time values.
   * 
   * See TREND_CALCULATION_DOCS.md for detailed documentation and test cases.
   */
  occupancyTrend = { percentage: 0, direction: 'up' as 'up' | 'down' };
  footfallTrend = { percentage: 0, direction: 'up' as 'up' | 'down' };
  dwellTimeTrend = { percentage: 0, direction: 'up' as 'up' | 'down' };
  
  // Cache for yesterday's data (to prevent redundant API calls)
  private yesterdayDataCache: { 
    date: string, 
    footfall: number, 
    dwellMinutes: number, 
    avgOccupancy: number 
  } | null = null;
  private trendCalculationInProgress = false;
  
  // Date Selection
  selectedDate: Date = new Date();
  maxDate: Date = new Date();
  dateDisplayText: string = 'Today'; 
  currentSiteId = '';
  malePercentage = 55;
  femalePercentage = 45;
  sidebarOpen = true;
  currentLiveValue = 0; // Current occupancy value being updated
  isLoading = false; // Loading state for API calls
  private currentTimeAnnotation: Date = new Date();
  
  private socketSub: Subscription | undefined;
  private siteSub: Subscription | undefined;
  private logoutSub: Subscription | undefined;
  private markerTimerSub: Subscription | undefined;
  
  // Store chart time range for marker calculations
  private chartStartHour = 0;
  private chartEndHour = 0;
  private chartInitialized = false;


  // Chart 1: Occupancy
  public occupancyChartData: any = {
    datasets: [{
      data: [], // Will be array of {x: Date, y: number}
      label: 'Occupancy',
      fill: 'start',
      tension: 0.4,
      borderColor: '#009688',
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        
        if (!chartArea) {
          return 'rgba(0, 150, 136, 0.1)';
        }
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(0, 150, 136, 0.5)');
        gradient.addColorStop(0.5, 'rgba(0, 150, 136, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 150, 136, 0)');
        return gradient;
      },
      borderWidth: 2,
      spanGaps: true,
      pointRadius: 0,
      pointHoverRadius: 0
    }]
  };
  public occupancyChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { 
      legend: { 
        display: false
      },
      annotation: {
        annotations: {
          liveMarker: {
            type: 'line',
            xMin: (() => {
              const now = new Date();
              now.setHours(now.getHours(), now.getMinutes(), 0, 0);
              return now.getTime();
            })(),
            xMax: (() => {
              const now = new Date();
              now.setHours(now.getHours(), now.getMinutes(), 0, 0);
              return now.getTime();
            })(),
            borderColor: '#d32f2f',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: 'LIVE',
              position: 'end',
              rotation: -90,
              backgroundColor: '#d32f2f',
              color: '#ffffff',
              font: {
                size: 10,
                weight: 'bold',
                family: 'IBM Plex Sans'
              },
              yAdjust: -3,
              padding: {
                top: 4,
                bottom: 4,
                left: 6,
                right: 6
              },
              borderRadius: 3
            }
          }
        } as any
      }
    },
    scales: { 
      x: { 
        type: 'time',
        adapters: {
          date: {}
        },
        time: {
          unit: 'hour',
          displayFormats: {
            hour: 'HH:mm'
          },
          tooltipFormat: 'HH:mm'
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 13 },
          color: '#666'
        },
        grid: { 
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          color: '#666',
          font: { size: 12 },
          source: 'auto'
        },
        border: {
          display: false
        }
      }, 
      y: { 
        title: {
          display: true,
          text: 'Count',
          font: { size: 13 },
          color: '#666'
        },
        min: 0,
        max: 250,
        beginAtZero: true,
        grid: { 
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: '#666',
          font: { size: 12 }
        },
        border: {
          display: false
        }
      } 
    }
  };

  // Chart 2: Demographics Donut
  public donutChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Males', 'Females'],
    datasets: [{
      data: [50, 50],
      backgroundColor: ['#5F9EA0', '#A7D8DA'],
      borderWidth: 0,
      borderRadius: 8,
      spacing: 4
    }]
  };
  public donutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: { 
      legend: { display: false },
      tooltip: {
        enabled: true
      }
    },
    elements: {
      arc: {
        borderWidth: 0,
        borderRadius: 8
      }
    }
  };

  // Chart 3: Demographics Line Chart (Male/Female over time)
  public demographicsLineChartData: any = {
    datasets: [
      {
        data: [], // Will be array of {x: Date, y: number}
        label: 'Male',
        fill: true,
        tension: 0.5,
        borderColor: '#2A7F7D',
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          
          if (!chartArea) {
            return 'rgba(42, 127, 125, 0.1)';
          }
          
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(42, 127, 125, 0.4)');
          gradient.addColorStop(0.5, 'rgba(42, 127, 125, 0.15)');
          gradient.addColorStop(1, 'rgba(42, 127, 125, 0)');
          return gradient;
        },
        pointBackgroundColor: '#2A7F7D',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        spanGaps: true
      },
      {
        data: [], // Will be array of {x: Date, y: number}
        label: 'Female',
        fill: true,
        tension: 0.5,
        borderColor: '#47B2B0',
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          
          if (!chartArea) {
            return 'rgba(71, 178, 176, 0.1)';
          }
          
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(71, 178, 176, 0.35)');
          gradient.addColorStop(0.5, 'rgba(71, 178, 176, 0.12)');
          gradient.addColorStop(1, 'rgba(71, 178, 176, 0)');
          return gradient;
        },
        pointBackgroundColor: '#47B2B0',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        spanGaps: true
      }
    ]
  };
  public demographicsLineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: {
      padding: {
        top: 0
      }
    },
    plugins: { 
      legend: { 
        display: false
      } 
    },
    scales: { 
      x: { 
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: {
            hour: 'HH:mm'
          },
          tooltipFormat: 'HH:mm'
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 13, family: 'IBM Plex Sans' },
          color: '#666'
        },
        grid: { 
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          color: '#666',
          font: { size: 12 },
          source: 'auto'
        },
        border: {
          display: false
        }
      }, 
      y: { 
        title: {
          display: true,
          text: 'Count',
          font: { size: 13, family: 'IBM Plex Sans' },
          color: '#666'
        },
        min: 0,
        max: 300,
        beginAtZero: true,
        grid: { 
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: '#666',
          font: { size: 12 }
        }
      } 
    }
  };

  constructor(
    private dashboardLoader: DashboardLoaderService,
    private socketService: SocketService,
    private siteService: SiteService,
    private entryCacheService: EntryExitCacheService,
    private dashboardCache: DashboardCacheService,
    private cleanupService: CleanupService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Get current site immediately if available
    const currentSite = this.siteService.getCurrentSite();
    if (currentSite) {
      console.log('🏃 Pre-loading current site:', currentSite.name);
      this.currentSiteId = currentSite.siteId;
      this.siteName = currentSite.name;
    }
    
    // Subscribe to logout events for cleanup
    this.logoutSub = this.cleanupService.onLogout$.subscribe(() => {
      this.cleanupOnLogout();
    });
    
    // Start Socket first (will filter by currentSiteId)
    // This ensures socket is always listening when component loads
    this.setupRealtimeUpdates();
    
    // Timer will start after chart is initialized
    
    // Subscribe to site changes
    this.siteSub = this.siteService.currentSite$.subscribe(site => {
      if (site) {
        const siteChanged = this.currentSiteId !== site.siteId;
        
        console.log(' Site changed to:', site.name, '(changed:', siteChanged, ')');
        this.currentSiteId = site.siteId;
        this.siteName = site.name;
        
        // Only reload dashboard data if site actually changed or first load
        if (siteChanged || this.todaysFootfall === 0) {
          this.loadDashboardData(site.siteId, site.name);
          
          // Preload entry-exit data in background for better UX
          console.log(' Preloading entry-exit data in background');
          this.entryCacheService.preloadData(site.siteId, this.selectedDate);
        } else {
          console.log('✓ Site unchanged, keeping current dashboard data');
        }
      } else {
        console.log('⏳ Waiting for site selection...');
      }
    });
  }

  private loadDashboardData(siteId: string, siteName: string) {
    // Check cache first
    const cached = this.dashboardCache.getCache(siteId, this.selectedDate);
    if (cached) {
      console.log(' Using cached dashboard data - skipping API calls');
      this.applyCachedData(cached);
      return;
    }
    
    console.log('/// No cache found - loading from API');
    this.isLoading = true;
    this.dashboardLoader.loadDashboard(siteId, siteName, this.selectedDate).subscribe({
      next: (data) => {
        console.log(' Full Dashboard Data:', data);
        
        // Store in cache
        this.dashboardCache.setCache(siteId, this.selectedDate, data);
        
        if (data.footfall) {
          console.log(' Footfall data:', data.footfall);
          this.todaysFootfall = data.footfall.footfall || 0;
          console.log(' Today\'s Footfall value set to:', this.todaysFootfall);
        }
        if (data.dwell) {
          console.log(' Dwell data:', data.dwell);
          this.avgDwellTime = this.formatDwellTime(data.dwell.avgDwellMinutes);
          console.log(' Avg Dwell Time set to:', this.avgDwellTime);
        }

        if (data.occupancy && data.occupancy.buckets) {
           this.updateOccupancyChart(data.occupancy.buckets);
        }
        if (data.demographics && data.demographics.buckets) {
           this.updateDemographicsChart(data.demographics.buckets);
        }
        
        // Load yesterday's data for trend comparison
        this.loadYesterdayDataForTrends(siteId, siteName);
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Dashboard Load Failed:', err);
        this.siteName = 'Error Loading Data';
        this.isLoading = false;
      }
    });
  }

  // --- Helpers ---
  updateOccupancyChart(buckets: any[]) {
    console.log(' API returned', buckets.length, 'occupancy buckets');
    
    const hasData = buckets && buckets.length > 0;
    if (!hasData) {
      console.warn(' No buckets from API - initializing with live data only');
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Determine fixed time range based on current hour
    let startHour: number;
    let endHour: number;
    
    if (currentHour >= 0 && currentHour < 8) {
      startHour = 0;
      endHour = 8;
    } else {
      startHour = 8;
      // Ensure we always include current hour + 3 hours buffer minimum
      endHour = Math.max(18, currentHour + 3);
    }
    
    // CRITICAL: If current time is past chart end, extend it
    if (currentHour >= endHour) {
      endHour = currentHour + 3;
      console.log(' Extended chart range to accommodate current hour:', endHour);
    }
    
    // Store for marker updates
    this.chartStartHour = startHour;
    this.chartEndHour = endHour;
    
    console.log(' Chart time range:', startHour + ':00 to', endHour + ':00');
    
    // Create data points with Date objects for time scale
    const occupancyData: Array<{x: Date, y: number}> = [];
    const hourlyValues: Map<number, number> = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    // Helper to parse timestamps
    const parseTimestamp = (bucket: any): Date => {
      const tsString = bucket.local || bucket.ts || bucket.timestamp || bucket.time || bucket.date;
      let date = new Date(tsString);
      
      if (isNaN(date.getTime()) && typeof tsString === 'string') {
        const parts = tsString.split(' ');
        if (parts.length === 2) {
          const datePart = parts[0].split('/');
          const timePart = parts[1].split(':');
          
          if (datePart.length === 3 && timePart.length === 3) {
            date = new Date(
              parseInt(datePart[2]),
              parseInt(datePart[1]) - 1,
              parseInt(datePart[0]),
              parseInt(timePart[0]),
              parseInt(timePart[1]),
              parseInt(timePart[2])
            );
          }
        }
      }
      
      return date;
    };
    
    // Map buckets to hourly values (only if we have data)
    if (hasData) {
      buckets.forEach(bucket => {
        const timestamp = parseTimestamp(bucket);
        
        if (isNaN(timestamp.getTime())) {
          console.warn(' Invalid timestamp for bucket:', bucket);
          return;
        }
        
        const hour = timestamp.getHours();
        const value = bucket.avg || bucket.siteOccupancy || bucket.occupancy || bucket.count || bucket.value || 0;
        
        if (hour >= startHour && hour <= endHour) {
          hourlyValues.set(hour, value);
        }
      });
    }
    
    // Build continuous data from start to current time
    let lastKnownValue = this.liveOccupancy > 0 ? this.liveOccupancy : 0;
    
    for (let hour = startHour; hour <= currentHour; hour++) {
      const pointDate = new Date(today);
      pointDate.setHours(hour, 0, 0, 0);
      
      if (hourlyValues.has(hour)) {
        lastKnownValue = hourlyValues.get(hour)!;
      }
      
      occupancyData.push({ x: pointDate, y: lastKnownValue });
    }
    
    // Override current hour with live value
    if (this.liveOccupancy > 0 && occupancyData.length > 0) {
      occupancyData[occupancyData.length - 1].y = this.liveOccupancy;
      lastKnownValue = this.liveOccupancy;
      console.log(' Set current hour', currentHour + ':00 to live value:', this.liveOccupancy);
    }
    
    // Add intermediate point at CURRENT TIME for continuous line
    if (currentMinute > 0) {
      const currentTimePoint = new Date(today);
      currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
      occupancyData.push({
        x: currentTimePoint,
        y: lastKnownValue
      });
      console.log(' Added current time point:', currentHour + ':' + currentMinute, 'value:', lastKnownValue);
    }
    
    console.log('|| Chart initialized: data filled to', currentHour + ':' + currentMinute);
    console.log(' Chart data points:', occupancyData.length);
    console.log(' Sample data:', occupancyData.slice(0, 3).map(p => ({ 
      time: p.x.toLocaleTimeString(), 
      value: p.y 
    })));

    // Set axis bounds
    const minDate = new Date(today);
    minDate.setHours(startHour, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setHours(endHour, 0, 0, 0);
    
    // Update chart data structure with bounds
    this.occupancyChartData.datasets[0].data = occupancyData;
    
    // Update chart options with dynamic bounds
    this.occupancyChartOptions = {
      ...this.occupancyChartOptions,
      scales: {
        ...this.occupancyChartOptions.scales,
        x: {
          ...this.occupancyChartOptions.scales?.['x'],
          min: minDate.getTime(),
          max: maxDate.getTime()
        } as any
      }
    };
    
    this.occupancyChartData = { ...this.occupancyChartData };
    
    console.log('Chart X-axis range:', minDate.toLocaleTimeString(), '-', maxDate.toLocaleTimeString());
    
    // Mark chart as initialized and start timer
    this.chartInitialized = true;
    
    // Initialize annotation marker position
    if (occupancyData.length > 0) {
      const lastPoint = occupancyData[occupancyData.length - 1];
      const timestamp = new Date(lastPoint.x).getTime();
      
      if (this.occupancyChartOptions.plugins?.annotation) {
        const annotations = this.occupancyChartOptions.plugins.annotation.annotations as any;
        if (annotations && annotations.liveMarker) {
          annotations.liveMarker.xMin = timestamp;
          annotations.liveMarker.xMax = timestamp;
          console.log('Initial marker position set to:', new Date(timestamp).toLocaleTimeString());
        }
      }
    }
    
    this.startMarkerUpdateTimer();
    
    console.log(' Chart initialization complete');
    
    // Ensure socket subscription is active for live updates
    if (!this.socketSub || this.socketSub.closed || !this.socketService.isConnected()) {
      console.log(' Re-establishing socket connection for live updates');
      this.setupRealtimeUpdates();
    } else {
      console.log(' Socket subscription active and connected');
    }
  }

  updateDemographicsChart(buckets: any[]) {
    console.log(' Raw Demographics buckets received:', JSON.stringify(buckets, null, 2));
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Determine timestamp range
    let startHour: number;
    let endHour: number;
    
    if (currentHour >= 0 && currentHour < 8) {
      startHour = 0;
      endHour = 8;
    } else {
      startHour = 8;
      endHour = Math.max(18, currentHour + 3);
    }
    
    console.log('Demographics chart range:', startHour + ':00 to', endHour + ':00');
    
    // Create data points with Date objects
    const maleData: Array<{x: Date, y: number}> = [];
    const femaleData: Array<{x: Date, y: number}> = [];
    const hourlyMaleValues: Map<number, number> = new Map();
    const hourlyFemaleValues: Map<number, number> = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Variables for donut chart totals
    let totalMale = 0;
    let totalFemale = 0;
    
    // Parse timestamp helper (same as occupancy chart)
    const parseTimestamp = (bucket: any): Date => {
      const tsString = bucket.local || bucket.ts || bucket.timestamp || bucket.time || bucket.date;
      let date = new Date(tsString);
      
      if (isNaN(date.getTime()) && typeof tsString === 'string') {
        const parts = tsString.split(' ');
        if (parts.length === 2) {
          const datePart = parts[0].split('/');
          const timePart = parts[1].split(':');
          
          if (datePart.length === 3 && timePart.length === 3) {
            date = new Date(
              parseInt(datePart[2]),
              parseInt(datePart[1]) - 1,
              parseInt(datePart[0]),
              parseInt(timePart[0]),
              parseInt(timePart[1]),
              parseInt(timePart[2])
            );
          }
        }
      }
      return date;
    };
    
    // Map API buckets to hourly values
    if (buckets && buckets.length > 0) {
      console.log(` Processing ${buckets.length} demographics buckets`);
      buckets.forEach((bucket, idx) => {
        const timestamp = parseTimestamp(bucket);
        
        if (isNaN(timestamp.getTime())) {
          console.warn(' Invalid timestamp for demographics bucket:', bucket);
          return;
        }
        
        const hour = timestamp.getHours();
        const male = bucket.male || 0;
        const female = bucket.female || 0;
        
        if (hour >= startHour && hour <= endHour) {
          hourlyMaleValues.set(hour, male);
          hourlyFemaleValues.set(hour, female);
          totalMale += male;
          totalFemale += female;
          console.log(` Hour ${hour}:00 -> Male: ${male}, Female: ${female}`);
        } else {
          console.log(` Skipped bucket ${idx} (hour ${hour} outside range ${startHour}-${endHour})`);
        }
      });
    }
    
    console.log(' Historical data mapped - Male values:', Array.from(hourlyMaleValues.entries()));
    console.log(' Historical data mapped - Female values:', Array.from(hourlyFemaleValues.entries()));
    
    // Build continuous data for ALL HOURS with historical data (not just up to current hour)
    let lastMaleValue = 0;
    let lastFemaleValue = 0;
    
    // First, add all hourly data points from historical buckets
    for (let hour = startHour; hour <= endHour; hour++) {
      const pointDate = new Date(today);
      pointDate.setHours(hour, 0, 0, 0);
      
      // Update values if we have data for this hour
      if (hourlyMaleValues.has(hour)) {
        lastMaleValue = hourlyMaleValues.get(hour)!;
      }
      if (hourlyFemaleValues.has(hour)) {
        lastFemaleValue = hourlyFemaleValues.get(hour)!;
      }
      
      // Only add points up to current hour + current time
      if (hour < currentHour || (hour === currentHour)) {
        maleData.push({ x: pointDate, y: lastMaleValue });
        femaleData.push({ x: pointDate, y: lastFemaleValue });
      }
    }
    
    // Add current time point if we're in the middle of an hour
    if (currentMinute > 0 && currentHour >= startHour && currentHour <= endHour) {
      const currentTimePoint = new Date(today);
      currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
      maleData.push({ x: currentTimePoint, y: lastMaleValue });
      femaleData.push({ x: currentTimePoint, y: lastFemaleValue });
      console.log(` Added current time point at ${currentHour}:${currentMinute} - Male: ${lastMaleValue}, Female: ${lastFemaleValue}`);
    }
    
    console.log(' Demographics data points built:', maleData.length);
    console.log(' Sample male data:', maleData.slice(0, 5).map(p => ({ time: p.x.toLocaleTimeString(), value: p.y })));
    console.log(' Sample female data:', femaleData.slice(0, 5).map(p => ({ time: p.x.toLocaleTimeString(), value: p.y })));
    
    // Update chart data
    this.demographicsLineChartData.datasets[0].data = maleData;
    this.demographicsLineChartData.datasets[1].data = femaleData;
    
    // Set axis bounds
    const minDate = new Date(today);
    minDate.setHours(startHour, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setHours(endHour, 0, 0, 0);
    
    this.demographicsLineChartOptions = {
      ...this.demographicsLineChartOptions,
      scales: {
        ...this.demographicsLineChartOptions.scales,
        x: {
          ...this.demographicsLineChartOptions.scales?.['x'],
          min: minDate.getTime(),
          max: maxDate.getTime()
        } as any
      }
    };
    
    this.demographicsLineChartData = { ...this.demographicsLineChartData };
    
    // Update donut chart
    this.donutChartData.datasets[0].data = [totalMale, totalFemale];
    this.updateDemographicsPercentages(totalMale, totalFemale);
    this.donutChartData = { ...this.donutChartData };
    
    console.log(' Demographics line chart updated with real-time data');
  }

  formatDwellTime(minutes: number): string {
    if (!minutes || minutes === 0) return '--';
    
    // Convert minutes to total seconds
    const totalSeconds = Math.round(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    
    return `${mins} min ${secs} sec`;
  }

  loadYesterdayDataForTrends(siteId: string, siteName: string) {
    // Prevent duplicate API calls if already in progress
    if (this.trendCalculationInProgress) {
      console.log(' Trend calculation already in progress, skipping...');
      return;
    }
    
    const yesterday = new Date(this.selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateKey = yesterday.toDateString();
    
    // Check cache first
    if (this.yesterdayDataCache && this.yesterdayDataCache.date === yesterdayDateKey) {
      console.log(' Using cached yesterday\'s data for trends');
      this.calculateAllTrends(
        this.yesterdayDataCache.footfall,
        this.yesterdayDataCache.dwellMinutes,
        this.yesterdayDataCache.avgOccupancy
      );
      return;
    }
    
    console.log(' Loading yesterday\'s data for trend comparison:', yesterdayDateKey);
    this.trendCalculationInProgress = true;
    
    // Load yesterday's data
    this.dashboardLoader.loadDashboard(siteId, siteName, yesterday).subscribe({
      next: (yesterdayData) => {
        console.log(' Yesterday\'s data loaded:', yesterdayData);
        
        // Extract and validate yesterday's metrics
        const yesterdayFootfall = this.extractValidNumber(yesterdayData.footfall?.footfall);
        const yesterdayDwell = this.extractValidNumber(yesterdayData.dwell?.avgDwellMinutes);
        const yesterdayAvg = yesterdayData.occupancy?.buckets 
          ? this.calculateAverageOccupancy(yesterdayData.occupancy.buckets) 
          : 0;
        
        // Cache the data
        this.yesterdayDataCache = {
          date: yesterdayDateKey,
          footfall: yesterdayFootfall,
          dwellMinutes: yesterdayDwell,
          avgOccupancy: yesterdayAvg
        };
        
        // Calculate trends
        this.calculateAllTrends(yesterdayFootfall, yesterdayDwell, yesterdayAvg);
        this.trendCalculationInProgress = false;
      },
      error: (err) => {
        console.warn(' Could not load yesterday\'s data for trends:', err);
        this.trendCalculationInProgress = false;
        // Keep default trend values (0, 'up') - indicates no data available
      }
    });
  }
  
  private calculateAllTrends(yesterdayFootfall: number, yesterdayDwell: number, yesterdayAvg: number) {
    // Footfall trend
    const todayFootfall = this.extractValidNumber(this.todaysFootfall);
    this.footfallTrend = this.calculateTrend(todayFootfall, yesterdayFootfall);
    console.log(' Footfall trend:', `${todayFootfall} vs ${yesterdayFootfall} =`, this.footfallTrend);
    
    // Dwell time trend
    const todayDwell = this.parseDwellTimeToMinutes(this.avgDwellTime);
    this.dwellTimeTrend = this.calculateTrend(todayDwell, yesterdayDwell);
    console.log(' Dwell time trend:', `${todayDwell.toFixed(2)}min vs ${yesterdayDwell.toFixed(2)}min =`, this.dwellTimeTrend);
    
    // Occupancy trend - compare today's average (not just live) with yesterday's average
    const todayAvgOccupancy = this.calculateTodayAverageOccupancy();
    this.occupancyTrend = this.calculateTrend(todayAvgOccupancy, yesterdayAvg);
    console.log(' Occupancy trend:', `${todayAvgOccupancy} vs ${yesterdayAvg} =`, this.occupancyTrend);
  }

  calculateTrend(today: number, yesterday: number): { percentage: number, direction: 'up' | 'down' } {
    // Validate inputs - handle NaN, negative, and invalid values
    if (!this.isValidNumber(today)) today = 0;
    if (!this.isValidNumber(yesterday)) yesterday = 0;
    
    // Edge case: No data for either day
    if (today === 0 && yesterday === 0) {
      return { percentage: 0, direction: 'up' };
    }
    
    // Edge case: No yesterday data (first day of operation)
    if (yesterday === 0) {
      // If today has data, it's 100% increase (but cap at 100 for display)
      return { percentage: today > 0 ? 100 : 0, direction: 'up' };
    }
    
    // Edge case: No data today but had data yesterday
    if (today === 0) {
      return { percentage: 100, direction: 'down' };
    }
    
    // Normal calculation
    const difference = ((today - yesterday) / yesterday) * 100;
    const absDifference = Math.abs(difference);
    
    // Cap percentage at 999% to avoid display issues with extreme outliers
    // (e.g., going from 1 to 1000 would be 99,900%)
    const cappedPercentage = Math.min(Math.round(absDifference), 999);
    
    return {
      percentage: cappedPercentage,
      direction: difference >= 0 ? 'up' : 'down'
    };
  }
  
  private isValidNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value) && value >= 0;
  }
  
  private extractValidNumber(value: any): number {
    if (this.isValidNumber(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (this.isValidNumber(parsed)) return parsed;
    }
    return 0;
  }

  parseDwellTimeToMinutes(dwellTime: string): number {
    if (!dwellTime || dwellTime === '--' || dwellTime.trim() === '') return 0;
    
    try {
      // Parse "22 min 25 sec" format
      const parts = dwellTime.split(' ');
      
      if (parts.length < 2) return 0;
      
      const mins = parseInt(parts[0]);
      const secs = parts.length >= 3 ? parseInt(parts[2]) : 0;
      
      // Validate parsed values
      const validMins = this.isValidNumber(mins) ? mins : 0;
      const validSecs = this.isValidNumber(secs) ? secs : 0;
      
      return validMins + (validSecs / 60);
    } catch (error) {
      console.warn(' Failed to parse dwell time:', dwellTime, error);
      return 0;
    }
  }

  calculateAverageOccupancy(buckets: any[]): number {
    if (!buckets || buckets.length === 0) return 0;
    
    let total = 0;
    let count = 0;
    
    buckets.forEach(bucket => {
      const value = bucket.avg || bucket.siteOccupancy || bucket.occupancy || 0;
      if (value > 0) {
        total += value;
        count++;
      }
    });
    
    return count > 0 ? Math.round(total / count) : 0;
  }
  
  private calculateTodayAverageOccupancy(): number {
    // Use the occupancy chart data for accurate average
    const occupancyDataset = this.occupancyChartData?.datasets?.[0]?.data;
    
    if (!occupancyDataset || occupancyDataset.length === 0) {
      // Fallback to live occupancy if no historical data
      return this.liveOccupancy;
    }
    
    let total = 0;
    let count = 0;
    
    occupancyDataset.forEach((point: any) => {
      if (point && typeof point.y === 'number' && point.y > 0) {
        total += point.y;
        count++;
      }
    });
    
    return count > 0 ? Math.round(total / count) : this.liveOccupancy;
  }

  updateDemographicsPercentages(male: number, female: number): void {
    const total = male + female;
    if (total === 0) {
      this.malePercentage = 50;
      this.femalePercentage = 50;
    } else {
      this.malePercentage = Math.round((male / total) * 100);
      this.femalePercentage = Math.round((female / total) * 100);
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout(): void {
    console.log('👋 User logging out');
    // Clear all caches
    this.dashboardCache.clearCache();
    this.entryCacheService.clearCache();
    // Trigger cleanup across all components
    this.cleanupService.triggerLogout();
    // Call auth service logout
    this.authService.logout();
    // Navigate to login
    this.router.navigate(['/login']);
  }
  
  private applyCachedData(cached: any): void {
    console.log(' Applying cached dashboard data');
    
    // Apply footfall
    if (cached.footfall) {
      this.todaysFootfall = cached.footfall.footfall || 0;
      console.log(' Cached Footfall:', this.todaysFootfall);
    }
    
    // Apply dwell time
    if (cached.dwell) {
      this.avgDwellTime = this.formatDwellTime(cached.dwell.avgDwellMinutes);
      console.log(' Cached Dwell Time:', this.avgDwellTime);
    }
    
    // Apply occupancy chart
    if (cached.occupancy && cached.occupancy.buckets) {
      this.updateOccupancyChart(cached.occupancy.buckets);
    }
    
    // Apply demographics
    if (cached.demographics && cached.demographics.buckets) {
      this.updateDemographicsChart(cached.demographics.buckets);
    }
  }

  onDateChange(date: Date | null): void {
    if (!date) return;
    
    this.selectedDate = date;
    this.updateDateDisplayText();
    
    console.log(' User selected date:', date.toLocaleDateString());
    console.log(' Display text:', this.dateDisplayText);
    
    // Clear yesterday's data cache since we're changing dates
    this.clearTrendCache();
    
    // Reload dashboard data for selected date
    if (this.currentSiteId) {
      console.log(' Reloading dashboard for site:', this.currentSiteId);
      this.loadDashboardData(this.currentSiteId, this.siteName);
      
      // Also preload entry-exit data for new date
      console.log(' Preloading entry-exit data for new date');
      this.entryCacheService.clearCache();
      this.entryCacheService.preloadData(this.currentSiteId, this.selectedDate);
      
      // Clear dashboard cache too
      this.dashboardCache.clearCache();
    } else {
      console.warn(' No site selected, cannot reload dashboard');
    }
  }

  updateDateDisplayText(): void {
    // Get today and yesterday without time
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

  setupRealtimeUpdates() {
    // Check if socket is connected, if not reconnect
    if (!this.socketService.isConnected()) {
      console.log(' Socket not connected, reconnecting...');
      this.socketService.connect();
    }
    
    // If subscription already exists and is active, don't create a new one
    if (this.socketSub && !this.socketSub.closed) {
      console.log(' Socket subscription already active, reusing it');
      return;
    }
    
    console.log(' Setting up real-time socket updates');
    this.socketSub = this.socketService.getLiveOccupancyUpdates().subscribe((data: any) => {
      if (!data) return;
      
      // Filter: Only show data for the current site
      if (data.siteId !== this.currentSiteId) {
        console.log(' Ignoring socket data for different site:', data.siteId);
        return;
      }
      
      console.log('/// Live socket data received for current site:', data);
      
      // Update live occupancy (use siteOccupancy from socket data)
      if (data.siteOccupancy !== undefined) {
        this.liveOccupancy = data.siteOccupancy;
        console.log(' Live occupancy updated:', this.liveOccupancy);
      }
      
      // Note: footfall and dwellTime are NOT sent via socket - they only come from API
      
      // Update demographics from live data
      if (data.genderCount) {
        const male = data.genderCount.male || 0;
        const female = data.genderCount.female || 0;
        
        // Update donut chart
        this.donutChartData.datasets[0].data = [male, female];
        this.updateDemographicsPercentages(male, female);
        this.donutChartData = { ...this.donutChartData };
        
        // Update demographics line chart with live values
        if (this.chartInitialized && this.demographicsLineChartData.datasets[0]?.data) {
          const maleData = this.demographicsLineChartData.datasets[0].data as Array<{x: Date, y: number}>;
          const femaleData = this.demographicsLineChartData.datasets[1].data as Array<{x: Date, y: number}>;
          
          const now = new Date();
          const currentHour = now.getHours();
          
          // Update current hour point with live values
          const maleHourPoint = maleData.find(point => {
            const pointDate = new Date(point.x);
            return pointDate.getHours() === currentHour && pointDate.getMinutes() === 0;
          });
          const femaleHourPoint = femaleData.find(point => {
            const pointDate = new Date(point.x);
            return pointDate.getHours() === currentHour && pointDate.getMinutes() === 0;
          });
          
          if (maleHourPoint) maleHourPoint.y = male;
          if (femaleHourPoint) femaleHourPoint.y = female;
          
          // Trigger line extension which will use these new values
          this.extendDemographicsLineToCurrentTime();
          
          console.log(' Live demographics updated - Male:', male, 'Female:', female);
        }
      }
      
      // Update Occupancy Chart with live data
      if (this.occupancyChartData.datasets[0]?.data && this.occupancyChartData.labels) {
         const currentData = this.occupancyChartData.datasets[0].data as number[];
         const currentLabels = this.occupancyChartData.labels as string[];
         
         // Safety check: Ensure arrays exist and are valid
         if (!Array.isArray(currentData) || !Array.isArray(currentLabels)) {
           console.warn(' Chart data structure invalid, skipping socket update');
           return;
         }
         
         // Parse socket timestamp
         let socketTime = new Date(data.ts);
         
         if (isNaN(socketTime.getTime()) && typeof data.ts === 'string') {
           const parts = data.ts.split(' ');
           if (parts.length === 2) {
             const datePart = parts[0].split('/');
             const timePart = parts[1].split(':');
             
             if (datePart.length === 3 && timePart.length === 3) {
               socketTime = new Date(
                 parseInt(datePart[2]),
                 parseInt(datePart[1]) - 1,
                 parseInt(datePart[0]),
                 parseInt(timePart[0]),
                 parseInt(timePart[1]),
                 parseInt(timePart[2])
               );
             }
           }
         }
         
         if (isNaN(socketTime.getTime())) {
           console.error('❌ Invalid socket timestamp:', data.ts);
           return;
         }
         
         const liveHour = socketTime.getHours();
         const liveMinute = socketTime.getMinutes();
         
         // Check if socket time is within chart range
         if (liveHour >= this.chartStartHour && liveHour <= this.chartEndHour) {
           // Update live occupancy
           this.liveOccupancy = data.siteOccupancy;
           this.currentLiveValue = data.siteOccupancy;
           
           // The extendLineToCurrentTime() method running every 5 seconds will pick this up
           console.log(' Socket update: live occupancy =', data.siteOccupancy, 'at', liveHour + ':' + liveMinute);
         } else {
           // Socket time is outside range - extend chart range dynamically
           console.warn(' Socket time', liveHour + ':' + liveMinute, 'outside chart range', this.chartStartHour + '-' + this.chartEndHour);
           
           // Extend chart end hour to accommodate new data
           if (liveHour > this.chartEndHour) {
             this.chartEndHour = liveHour + 3;
             console.log('🔧 Extended chart range to:', this.chartStartHour + '-' + this.chartEndHour);
             
             // Update live occupancy
             this.liveOccupancy = data.siteOccupancy;
             this.currentLiveValue = data.siteOccupancy;
             
             // Trigger line extension which will update the chart
             this.extendLineToCurrentTime();
           }
         }
      } else {
        console.warn(' Cannot update chart - chart data not initialized');
      }
    });
  }

  startMarkerUpdateTimer() {
    if (this.markerTimerSub) {
      this.markerTimerSub.unsubscribe();
    }
    
    // Update marker and line every 5 seconds using RxJS
    this.markerTimerSub = interval(5000).subscribe(() => {
      // IMPORTANT: Extend line FIRST, then update marker position
      this.extendLineToCurrentTime();
      this.extendDemographicsLineToCurrentTime();
      // Use setTimeout to ensure marker updates after chart has re-rendered
      setTimeout(() => {
        this.updateMarkerPosition();
      }, 100);
    });
    
    // Initial update
    this.extendLineToCurrentTime();
    this.extendDemographicsLineToCurrentTime();
    setTimeout(() => {
      this.updateMarkerPosition();
    }, 100);
    console.log(' Marker and line update timer started for both charts');
  }
  
  updateMarkerPosition() {
    if (this.chartStartHour === 0 && this.chartEndHour === 0) {
      return; // Chart not initialized yet
    }
    
    // Update annotation to current time - Chart.js handles positioning natively
    const currentData = this.occupancyChartData.datasets[0].data as Array<{x: Date, y: number}>;
    
    if (currentData.length === 0) return;
    
    // Sort data by time to get the last point
    const sortedData = [...currentData].sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
    const lastPoint = sortedData[sortedData.length - 1];
    
    if (lastPoint) {
      this.currentTimeAnnotation = new Date(lastPoint.x);
      const timestamp = this.currentTimeAnnotation.getTime();
      
      // Update chart options with new marker position
      if (this.occupancyChartOptions.plugins?.annotation) {
        const annotations = this.occupancyChartOptions.plugins.annotation.annotations as any;
        if (annotations && annotations.liveMarker) {
          annotations.liveMarker.xMin = timestamp;
          annotations.liveMarker.xMax = timestamp;
          
          // Force chart update
          this.occupancyChartData = { ...this.occupancyChartData };
          
          const timeStr = this.currentTimeAnnotation.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          console.log(` Native marker at: ${timeStr}`);
        }
      }
    }
  }
  
  extendLineToCurrentTime() {
    if (!this.chartInitialized || (this.chartStartHour === 0 && this.chartEndHour === 0)) {
      return;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    console.log(` Extending line - Current: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Range: ${this.chartStartHour}-${this.chartEndHour}`);
    
    if (currentHour >= this.chartStartHour && currentHour <= this.chartEndHour) {
      const currentData = [...this.occupancyChartData.datasets[0].data] as Array<{x: Date, y: number}>;
      
      // Find the last valid value
      let lastKnownValue = this.liveOccupancy > 0 ? this.liveOccupancy : 0;
      for (let i = currentData.length - 1; i >= 0; i--) {
        if (currentData[i].y > 0) {
          lastKnownValue = currentData[i].y;
          break;
        }
      }
      
      // Remove ONLY intermediate time points (non-hour timestamps that are not current minute)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filteredData = currentData.filter(point => {
        const pointDate = new Date(point.x);
        const pointHour = pointDate.getHours();
        const pointMinute = pointDate.getMinutes();
        // Keep all hour marks (00 minutes) OR if it's the current hour with current minute
        return pointMinute === 0 || (pointHour === currentHour && pointMinute === currentMinute);
      });
      
      // Update current hour with live value
      const currentHourPoint = filteredData.find(point => {
        const pointDate = new Date(point.x);
        return pointDate.getHours() === currentHour && pointDate.getMinutes() === 0;
      });
      
      if (currentHourPoint && this.liveOccupancy > 0) {
        currentHourPoint.y = this.liveOccupancy;
        lastKnownValue = this.liveOccupancy;
        console.log(` Updated hour ${currentHour}:00 to live value: ${this.liveOccupancy}`);
      }
      
      // Check if we already have current time point
      const hasCurrentTimePoint = filteredData.some(point => {
        const pointDate = new Date(point.x);
        return pointDate.getHours() === currentHour && pointDate.getMinutes() === currentMinute;
      });
      
      // Add current time point if not at exact hour and not already present
      if (currentMinute > 0 && !hasCurrentTimePoint) {
        const currentTimePoint = new Date(today);
        currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
        
        filteredData.push({
          x: currentTimePoint,
          y: lastKnownValue
        });
        console.log(` Added current time point at ${currentHour}:${currentMinute} with value: ${lastKnownValue}`);
      }
      
      // Sort by time
      filteredData.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
      
      // Update chart
      this.occupancyChartData = { 
        ...this.occupancyChartData,
        datasets: [{ 
          ...this.occupancyChartData.datasets[0], 
          data: filteredData
        }]
      };
      console.log(` Line extended with ${filteredData.length} points (from ${this.chartStartHour}:00 to ${currentHour}:${currentMinute})`);
    } else {
      console.warn(` Current hour ${currentHour} outside chart range ${this.chartStartHour}-${this.chartEndHour}`);
    }
  }

  extendDemographicsLineToCurrentTime() {
    if (!this.chartInitialized || (this.chartStartHour === 0 && this.chartEndHour === 0)) {
      return;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    console.log(` Extending demographics - Current: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
    
    if (currentHour >= this.chartStartHour && currentHour <= this.chartEndHour) {
      const maleData = [...this.demographicsLineChartData.datasets[0].data] as Array<{x: Date, y: number}>;
      const femaleData = [...this.demographicsLineChartData.datasets[1].data] as Array<{x: Date, y: number}>;
      
      // Find last known values
      let lastMaleValue = 0;
      let lastFemaleValue = 0;
      for (let i = maleData.length - 1; i >= 0; i--) {
        if (maleData[i].y > 0) {
          lastMaleValue = maleData[i].y;
          break;
        }
      }
      for (let i = femaleData.length - 1; i >= 0; i--) {
        if (femaleData[i].y > 0) {
          lastFemaleValue = femaleData[i].y;
          break;
        }
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Filter to keep hourly marks and current time point
      const filteredMaleData = maleData.filter(point => {
        const pointDate = new Date(point.x);
        const pointHour = pointDate.getHours();
        const pointMinute = pointDate.getMinutes();
        return pointMinute === 0 || (pointHour === currentHour && pointMinute === currentMinute);
      });
      
      const filteredFemaleData = femaleData.filter(point => {
        const pointDate = new Date(point.x);
        const pointHour = pointDate.getHours();
        const pointMinute = pointDate.getMinutes();
        return pointMinute === 0 || (pointHour === currentHour && pointMinute === currentMinute);
      });
      
      // Check if current time point exists
      const hasCurrentTimePoint = filteredMaleData.some(point => {
        const pointDate = new Date(point.x);
        return pointDate.getHours() === currentHour && pointDate.getMinutes() === currentMinute;
      });
      
      // Add current time point if needed
      if (currentMinute > 0 && !hasCurrentTimePoint) {
        const currentTimePoint = new Date(today);
        currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
        
        filteredMaleData.push({ x: currentTimePoint, y: lastMaleValue });
        filteredFemaleData.push({ x: currentTimePoint, y: lastFemaleValue });
        console.log(` Added demographics point at ${currentHour}:${currentMinute} M:${lastMaleValue} F:${lastFemaleValue}`);
      }
      
      // Sort by time
      filteredMaleData.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
      filteredFemaleData.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
      
      // Update chart
      this.demographicsLineChartData = {
        ...this.demographicsLineChartData,
        datasets: [
          { ...this.demographicsLineChartData.datasets[0], data: filteredMaleData },
          { ...this.demographicsLineChartData.datasets[1], data: filteredFemaleData }
        ]
      };
      console.log(` Demographics lines extended with ${filteredMaleData.length} points`);
    }
  }

  ngOnDestroy() {
    // Keep socket subscription alive when navigating to other pages
    // Socket will only be cleaned up on logout
    console.log(' Dashboard component destroyed but keeping socket alive');
    
    // Clear marker timer
    if (this.markerTimerSub) {
      this.markerTimerSub.unsubscribe();
    }
    
    // Only unsubscribe from site changes and logout listener
    if (this.siteSub) {
      this.siteSub.unsubscribe();
    }
    if (this.logoutSub) {
      this.logoutSub.unsubscribe();
    }
    
    // Clear trend cache to free memory
    this.clearTrendCache();
    
    // DO NOT disconnect socket or unsubscribe - keep it alive for smooth navigation
  }
  
  private clearTrendCache(): void {
    this.yesterdayDataCache = null;
    this.trendCalculationInProgress = false;
    console.log(' Trend cache cleared');
  }
  
  /**
   * Called only when user logs out - cleans up socket subscription
   */
  cleanupOnLogout() {
    console.log('Cleaning up socket subscription on logout');
    if (this.socketSub) {
      this.socketSub.unsubscribe();
      this.socketSub = undefined;
    }
    this.socketService.disconnect();
  }
}