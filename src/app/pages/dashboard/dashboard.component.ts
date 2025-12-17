import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, interval, forkJoin, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { DashboardLoaderService } from '../../services/dashboard-loader/dashboard-loader.service';
import { SocketService } from '../../services/socket.service';
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
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  
  siteName = 'Loading...';
  todaysFootfall = 0;
  avgDwellTime = '--';
  liveOccupancy = 0;

  occupancyTrend = { percentage: 0, direction: 'up' as 'up' | 'down' };
  footfallTrend = { percentage: 0, direction: 'up' as 'up' | 'down' };
  dwellTimeTrend = { percentage: 0, direction: 'up' as 'up' | 'down' };
  
  private yesterdayDataCache: { 
    date: string, 
    footfall: number, 
    dwellMinutes: number, 
    avgOccupancy: number 
  } | null = null;
  private trendCalculationInProgress = false;
  private dashboardLoadInProgress = false;
  
  selectedDate: Date = new Date();
  maxDate: Date = new Date();
  dateDisplayText: string = 'Today'; 
  currentSiteId = '';
  isViewingToday = true;
  malePercentage = 55;
  femalePercentage = 45;
  sidebarOpen = true;
  isLiveOccupancyLoading = true;
  isFootfallLoading = true;
  isDwellTimeLoading = true;
  isOccupancyDataLoaded = false;
  
  private socketSub: Subscription | undefined;
  private siteSub: Subscription | undefined;
  private logoutSub: Subscription | undefined;
  private markerTimerSub: Subscription | undefined;
  private destroy$ = new Subject<void>();
  
  private chartStartHour = 0;
  private chartEndHour = 0;
  private chartInitialized = false;


  public occupancyChartData: any = {
    datasets: [{
      data: [],
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

  public demographicsLineChartData: any = {
    datasets: [
      {
        data: [],
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
        data: [],
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
    private cleanupService: CleanupService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {

    this.logoutSub = this.cleanupService.onLogout$.subscribe(() => {
      this.cleanupOnLogout();
    });
    
    this.siteSub = this.siteService.currentSite$.subscribe(site => {
      if (site) {
        const isDifferentSite = this.currentSiteId !== site.siteId;
        
        if (isDifferentSite) {
          this.currentSiteId = site.siteId;
          this.siteName = site.name;
          this.isViewingToday = this.checkIsToday(this.selectedDate);          
          this.isFootfallLoading = true;
          this.isDwellTimeLoading = true;
          this.isLiveOccupancyLoading = true;
          this.footfallTrend = { percentage: 0, direction: 'up' };
          this.dwellTimeTrend = { percentage: 0, direction: 'up' };
          this.occupancyTrend = { percentage: 0, direction: 'up' };
          this.trendCalculationInProgress = false;
          this.dashboardLoadInProgress = false;
          
          if (this.isViewingToday) {
            this.setupRealtimeUpdates();
          }
          this.loadDashboardData(site.siteId, site.name);
        }
      }
    });
  }

  private loadDashboardData(siteId: string, siteName: string) {

    if (this.dashboardLoadInProgress) {
      console.warn('Dashboard load already in progress, skipping duplicate call');
      return;
    }
    if (!siteId) {
      console.error('Cannot load dashboard: siteId is empty');
      return;
    }
    
    this.dashboardLoadInProgress = true;
    this.isLiveOccupancyLoading = true;
    this.dashboardLoader.loadDashboard(siteId, siteName, this.selectedDate).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.dashboardLoadInProgress = false;
      })
    ).subscribe({
      next: (data) => {

        this.applyDashboardData(data);
        if (!this.isViewingToday) {
          this.isOccupancyDataLoaded = true;
        }
        if (this.isViewingToday) {
          this.loadTrendsWithCache(siteId, siteName);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Dashboard Load Failed:', err);
        this.siteName = 'Error Loading Data';
        this.cdr.detectChanges();
      }
    });
  }
  
  private applyDashboardData(data: any): void {
    if (data.footfall) {
      this.todaysFootfall = data.footfall.footfall || 0;
      this.isFootfallLoading = false;
    }
    if (data.dwell) {
      this.avgDwellTime = this.formatDwellTime(data.dwell.avgDwellMinutes);
      this.isDwellTimeLoading = false;
    }
    if (data.occupancy && data.occupancy.buckets) {
      this.updateOccupancyChart(data.occupancy.buckets, this.isViewingToday);
    }
    if (data.demographics && data.demographics.buckets) {
      this.updateDemographicsChart(data.demographics.buckets, this.isViewingToday);
    }
    this.cdr.detectChanges();
  }
  
  private loadTrendsWithCache(siteId: string, siteName: string): void {
    const yesterday = new Date(this.selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    this.loadYesterdayDataForTrends(siteId, siteName);
  }

  updateOccupancyChart(buckets: any[], isToday: boolean = true) {
    const hasData = buckets && buckets.length > 0;
    let currentHour: number;
    let currentMinute: number;
    
    if (!isToday) {
      currentHour = 18;
      currentMinute = 0;
    } else {
      const now = new Date();
      currentHour = now.getHours();
      currentMinute = now.getMinutes();
    }

    let startHour: number;
    let endHour: number;
    
    if (!isToday) {
      startHour = 8;
      endHour = 18;
    } else {
      if (currentHour >= 0 && currentHour < 8) {
        startHour = 0;
        endHour = 8;
      } else {
        startHour = 8;
        endHour = Math.max(18, currentHour + 3);
      }
      if (currentHour >= endHour) {
        endHour = currentHour + 3;
      }
    }
    
    this.chartStartHour = startHour;
    this.chartEndHour = endHour;
    
    const occupancyData: Array<{x: Date, y: number}> = [];
    const hourlyValues: Map<number, number> = new Map();
    const chartDate = new Date(this.selectedDate);
    chartDate.setHours(0, 0, 0, 0);
    
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
    
    if (hasData) {
      buckets.forEach(bucket => {
        const timestamp = parseTimestamp(bucket);
        
        if (isNaN(timestamp.getTime())) {
          return;
        }
        const hour = timestamp.getHours();
        const value = bucket.avg || bucket.siteOccupancy || bucket.occupancy || bucket.count || bucket.value || 0;
  
        if (hour >= startHour && hour <= endHour) {
          hourlyValues.set(hour, value);
        }
      });
    }
    
    let lastKnownValue = this.liveOccupancy > 0 && isToday ? this.liveOccupancy : 0;
    
    for (let hour = startHour; hour <= currentHour; hour++) {
      const pointDate = new Date(chartDate);
      pointDate.setHours(hour, 0, 0, 0);
      
      if (hourlyValues.has(hour)) {
        lastKnownValue = hourlyValues.get(hour)!;
      }
      occupancyData.push({ x: pointDate, y: lastKnownValue });
    }
    
    if (isToday && this.liveOccupancy > 0 && occupancyData.length > 0) {
      occupancyData[occupancyData.length - 1].y = this.liveOccupancy;
      lastKnownValue = this.liveOccupancy;
    }
    
    if (isToday && currentMinute > 0) {
      const currentTimePoint = new Date(chartDate);
      currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
      occupancyData.push({
        x: currentTimePoint,
        y: lastKnownValue
      });
    }

    const minDate = new Date(chartDate);
    minDate.setHours(startHour, 0, 0, 0);
    const maxDate = new Date(chartDate);
    maxDate.setHours(endHour, 0, 0, 0);
    
    this.occupancyChartData.datasets[0].data = occupancyData;
    
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
    
    this.chartInitialized = true;
    
    if (this.isViewingToday) {

      if (occupancyData.length > 0) {
        const lastPoint = occupancyData[occupancyData.length - 1];
        const timestamp = new Date(lastPoint.x).getTime();
        
        if (this.occupancyChartOptions.plugins?.annotation) {
          const annotations = this.occupancyChartOptions.plugins.annotation.annotations as any;
          if (annotations && annotations.liveMarker) {
            annotations.liveMarker.display = true;
            annotations.liveMarker.xMin = timestamp;
            annotations.liveMarker.xMax = timestamp;
          }
        }
      }

      this.startMarkerUpdateTimer();      
      if (!this.socketSub || this.socketSub.closed || !this.socketService.isConnected()) {
        this.setupRealtimeUpdates();
      }
    } else {
      if (this.occupancyChartOptions.plugins?.annotation) {
        const annotations = this.occupancyChartOptions.plugins.annotation.annotations as any;
        if (annotations && annotations.liveMarker) {
          annotations.liveMarker.display = false;
        }
      }
    }
  }

  updateDemographicsChart(buckets: any[], isToday: boolean = true) {
    let currentHour: number;
    let currentMinute: number;
    
    if (!isToday) {
      currentHour = 18;
      currentMinute = 0;
    } else {
      const now = new Date();
      currentHour = now.getHours();
      currentMinute = now.getMinutes();
    }
    
    let startHour: number;
    let endHour: number;
    
    if (!isToday) {
      startHour = 8;
      endHour = 18;
    } else if (currentHour >= 0 && currentHour < 8) {
      startHour = 0;
      endHour = 8;
    } else {
      startHour = 8;
      endHour = Math.max(18, currentHour + 3);
    }
    
    const maleData: Array<{x: Date, y: number}> = [];
    const femaleData: Array<{x: Date, y: number}> = [];
    const hourlyMaleValues: Map<number, number> = new Map();
    const hourlyFemaleValues: Map<number, number> = new Map();
    const chartDate = new Date(this.selectedDate);
    chartDate.setHours(0, 0, 0, 0);
    
    let totalMale = 0;
    let totalFemale = 0;
    
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
    
    if (buckets && buckets.length > 0) {
      buckets.forEach((bucket, idx) => {
        const timestamp = parseTimestamp(bucket);
        
        if (isNaN(timestamp.getTime())) {
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
        }
      });
    }
    
    let lastMaleValue = 0;
    let lastFemaleValue = 0;
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const pointDate = new Date(chartDate);
      pointDate.setHours(hour, 0, 0, 0);
      
      if (hourlyMaleValues.has(hour)) {
        lastMaleValue = hourlyMaleValues.get(hour)!;
      }
      if (hourlyFemaleValues.has(hour)) {
        lastFemaleValue = hourlyFemaleValues.get(hour)!;
      }
      if (hour < currentHour || (hour === currentHour)) {
        maleData.push({ x: pointDate, y: lastMaleValue });
        femaleData.push({ x: pointDate, y: lastFemaleValue });
      }
    }
    
    if (isToday && currentMinute > 0 && currentHour >= startHour && currentHour <= endHour) {
      const currentTimePoint = new Date(chartDate);
      currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
      maleData.push({ x: currentTimePoint, y: lastMaleValue });
      femaleData.push({ x: currentTimePoint, y: lastFemaleValue });
    }
    
    this.demographicsLineChartData.datasets[0].data = maleData;
    this.demographicsLineChartData.datasets[1].data = femaleData;
    
    const minDate = new Date(chartDate);
    minDate.setHours(startHour, 0, 0, 0);
    const maxDate = new Date(chartDate);
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
    
    this.donutChartData.datasets[0].data = [totalMale, totalFemale];
    this.updateDemographicsPercentages(totalMale, totalFemale);
    this.donutChartData = { ...this.donutChartData };
  }

  formatDwellTime(minutes: number): string {
    if (!minutes || minutes === 0) return '--';
    
    const totalSeconds = Math.round(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    
    return `${mins} min ${secs} sec`;
  }

  loadYesterdayDataForTrends(siteId: string, siteName: string) {
    if (this.trendCalculationInProgress) {
      return;
    }
    
    const yesterday = new Date(this.selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    this.trendCalculationInProgress = true;
    this.dashboardLoader.loadDashboard(siteId, siteName, yesterday).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.trendCalculationInProgress = false;
      })
    ).subscribe({
      next: (yesterdayData) => {
        const yesterdayFootfall = this.extractValidNumber(yesterdayData.footfall?.footfall);
        const yesterdayDwell = this.extractValidNumber(yesterdayData.dwell?.avgDwellMinutes);
        this.calculateFootfallAndDwellTrends(yesterdayFootfall, yesterdayDwell);
      },
      error: (err) => {
        console.error('Could not load yesterday data', err);
      }
    });
  }
  
  private calculateFootfallAndDwellTrends(yesterdayFootfall: number, yesterdayDwell: number) {

    const todayFootfall = this.extractValidNumber(this.todaysFootfall);
    this.footfallTrend = this.calculateTrend(todayFootfall, yesterdayFootfall);
    
    const todayDwell = this.parseDwellTimeToMinutes(this.avgDwellTime);
    this.dwellTimeTrend = this.calculateTrend(todayDwell, yesterdayDwell);
  }

  calculateTrend(today: number, yesterday: number): { percentage: number, direction: 'up' | 'down' } {
    if (!this.isValidNumber(today)) today = 0;
    if (!this.isValidNumber(yesterday)) yesterday = 0;
    if (today === 0 && yesterday === 0) {
      return { percentage: 0, direction: 'up' };
    }
    if (yesterday === 0) {
      return { percentage: today > 0 ? 100 : 0, direction: 'up' };
    }
    if (today === 0) {
      return { percentage: 100, direction: 'down' };
    }
    const difference = ((today - yesterday) / yesterday) * 100;
    const absDifference = Math.abs(difference);
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
      const parts = dwellTime.split(' ');
      
      if (parts.length < 2) return 0;
      
      const mins = parseInt(parts[0]);
      const secs = parts.length >= 3 ? parseInt(parts[2]) : 0;
      const validMins = this.isValidNumber(mins) ? mins : 0;
      const validSecs = this.isValidNumber(secs) ? secs : 0;
      
      return validMins + (validSecs / 60);
    } catch (error) {
      console.warn('Failed to parsing for dwell time:', dwellTime, error);
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
    
    const occupancyDataset = this.occupancyChartData?.datasets?.[0]?.data;
    if (!occupancyDataset || occupancyDataset.length === 0) {
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
    this.cleanupService.triggerLogout();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  private checkIsToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
  }
  
  onDateChange(date: Date | null): void {
    if (!date) return;
    
    this.selectedDate = date;
    this.updateDateDisplayText();
    this.isLiveOccupancyLoading = true;
    this.isFootfallLoading = true;
    this.isDwellTimeLoading = true;
    this.isViewingToday = this.checkIsToday(date);

    if (!this.isViewingToday) {
      if (this.markerTimerSub) {
        this.markerTimerSub.unsubscribe();
        this.markerTimerSub = undefined;
      }
    } else {
      this.setupRealtimeUpdates();
    }
    if (this.currentSiteId) {
      this.loadDashboardData(this.currentSiteId, this.siteName);
    }
  }

  updateDateDisplayText(): void {

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
    if (!this.socketService.isConnected()) {
      this.socketService.connect();
    }
    if (this.socketSub && !this.socketSub.closed) {
      return;
    }
    this.socketSub = this.socketService.getLiveOccupancyUpdates().subscribe((data: any) => {
      if (!data) return;
      if (data.siteId !== this.currentSiteId) {
        return;
      }
      if (data.siteOccupancy !== undefined) {
        this.liveOccupancy = data.siteOccupancy || 0;
        if (this.isLiveOccupancyLoading && this.liveOccupancy !== undefined) {
          this.isLiveOccupancyLoading = false;
        }
        this.cdr.detectChanges();
      }
      if (data.genderCount) {
        const male = data.genderCount.male || 0;
        const female = data.genderCount.female || 0;

        this.donutChartData.datasets[0].data = [male, female];
        this.updateDemographicsPercentages(male, female);
        this.donutChartData = { ...this.donutChartData };
        
        if (this.chartInitialized && this.demographicsLineChartData.datasets[0]?.data) {
          const maleData = this.demographicsLineChartData.datasets[0].data as Array<{x: Date, y: number}>;
          const femaleData = this.demographicsLineChartData.datasets[1].data as Array<{x: Date, y: number}>;
          
          const now = new Date();
          const currentHour = now.getHours();
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
          this.extendDemographicsLineToCurrentTime();
        }
      }
      if (this.occupancyChartData.datasets[0]?.data && this.occupancyChartData.labels) {
         const currentData = this.occupancyChartData.datasets[0].data as number[];
         const currentLabels = this.occupancyChartData.labels as string[];
         
         if (!Array.isArray(currentData) || !Array.isArray(currentLabels)) {
           return;
         }
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
           console.error('Invalid socket timestamp:', data.ts);
           return;
         }
         
         const liveHour = socketTime.getHours();
         //const liveMinute = socketTime.getMinutes();
         if (liveHour >= this.chartStartHour && liveHour <= this.chartEndHour) {
           this.liveOccupancy = data.siteOccupancy;
         } 
         else {
           if (liveHour > this.chartEndHour) {
             this.chartEndHour = liveHour + 3;
             this.liveOccupancy = data.siteOccupancy;
             this.extendLineToCurrentTime();
           }
         }
      }
    });
  }

  startMarkerUpdateTimer() {
    if (this.markerTimerSub) {
      this.markerTimerSub.unsubscribe();
    }
    
    this.markerTimerSub = interval(5000).subscribe(() => {
      this.extendLineToCurrentTime();
      this.extendDemographicsLineToCurrentTime();
      setTimeout(() => {
        this.updateMarkerPosition();
      }, 100);
    });
    
    this.extendLineToCurrentTime();
    this.extendDemographicsLineToCurrentTime();
    setTimeout(() => {
      this.updateMarkerPosition();
    }, 100);
  }
  
  updateMarkerPosition() {
    if (this.chartStartHour === 0 && this.chartEndHour === 0) {
      return;
    }

    const currentData = this.occupancyChartData.datasets[0].data as Array<{x: Date, y: number}>;
    if (currentData.length === 0) return;

    const sortedData = [...currentData].sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
    const lastPoint = sortedData[sortedData.length - 1];
    
    if (lastPoint) {
      const timestamp = new Date(lastPoint.x).getTime();

      if (this.occupancyChartOptions.plugins?.annotation) {
        const annotations = this.occupancyChartOptions.plugins.annotation.annotations as any;
        if (annotations && annotations.liveMarker) {
          annotations.liveMarker.xMin = timestamp;
          annotations.liveMarker.xMax = timestamp;
          this.occupancyChartData = { ...this.occupancyChartData };
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
    
    if (currentHour >= this.chartStartHour && currentHour <= this.chartEndHour) {
      const currentData = [...this.occupancyChartData.datasets[0].data] as Array<{x: Date, y: number}>;
      
      let lastKnownValue = this.liveOccupancy > 0 ? this.liveOccupancy : 0;
      for (let i = currentData.length - 1; i >= 0; i--) {
        if (currentData[i].y > 0) {
          lastKnownValue = currentData[i].y;
          break;
        }
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filteredData = currentData.filter(point => {
        const pointDate = new Date(point.x);
        const pointHour = pointDate.getHours();
        const pointMinute = pointDate.getMinutes();
        return pointMinute === 0 || (pointHour === currentHour && pointMinute === currentMinute);
      });
      
      const currentHourPoint = filteredData.find(point => {
        const pointDate = new Date(point.x);
        return pointDate.getHours() === currentHour && pointDate.getMinutes() === 0;
      });
      
      if (currentHourPoint && this.liveOccupancy > 0) {
        currentHourPoint.y = this.liveOccupancy;
        lastKnownValue = this.liveOccupancy;
      }
      
      const hasCurrentTimePoint = filteredData.some(point => {
        const pointDate = new Date(point.x);
        return pointDate.getHours() === currentHour && pointDate.getMinutes() === currentMinute;
      });
      
      if (currentMinute > 0 && !hasCurrentTimePoint) {
        const currentTimePoint = new Date(today);
        currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
        
        filteredData.push({
          x: currentTimePoint,
          y: lastKnownValue
        });
      }
      filteredData.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
      this.occupancyChartData = { 
        ...this.occupancyChartData,
        datasets: [{ 
          ...this.occupancyChartData.datasets[0], 
          data: filteredData
        }]
      };
    }
  }

  extendDemographicsLineToCurrentTime() {
    if (!this.chartInitialized || (this.chartStartHour === 0 && this.chartEndHour === 0)) {
      return;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentHour >= this.chartStartHour && currentHour <= this.chartEndHour) {
      const maleData = [...this.demographicsLineChartData.datasets[0].data] as Array<{x: Date, y: number}>;
      const femaleData = [...this.demographicsLineChartData.datasets[1].data] as Array<{x: Date, y: number}>;
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
      
      const hasCurrentTimePoint = filteredMaleData.some(point => {
        const pointDate = new Date(point.x);
        return pointDate.getHours() === currentHour && pointDate.getMinutes() === currentMinute;
      });
      
      if (currentMinute > 0 && !hasCurrentTimePoint) {
        const currentTimePoint = new Date(today);
        currentTimePoint.setHours(currentHour, currentMinute, 0, 0);
        filteredMaleData.push({ x: currentTimePoint, y: lastMaleValue });
        filteredFemaleData.push({ x: currentTimePoint, y: lastFemaleValue });
      }
      filteredMaleData.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
      filteredFemaleData.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
      
      this.demographicsLineChartData = {
        ...this.demographicsLineChartData,
        datasets: [
          { ...this.demographicsLineChartData.datasets[0], data: filteredMaleData },
          { ...this.demographicsLineChartData.datasets[1], data: filteredFemaleData }
        ]
      };
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.markerTimerSub) {
      this.markerTimerSub.unsubscribe();
    }
    if (this.siteSub) {
      this.siteSub.unsubscribe();
    }
    if (this.logoutSub) {
      this.logoutSub.unsubscribe();
    }
  }

  cleanupOnLogout() {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
      this.socketSub = undefined;
    }
    this.socketService.disconnect();
  }
}