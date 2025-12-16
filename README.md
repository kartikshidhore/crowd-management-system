# Crowd Management System

A comprehensive real-time crowd analytics and management dashboard built with Angular 18, featuring live occupancy tracking, demographic analysis, and historical trend visualization.

## Overview

The Crowd Management System provides facility managers with real-time insights into crowd patterns, occupancy levels, and demographic distribution. The application leverages WebSocket connections for live data updates and includes robust caching mechanisms for optimal performance.

## Features

### Dashboard
- **Real-time Occupancy Monitoring**: Live updates via WebSocket integration showing current site occupancy
- **Historical Trend Analysis**: Compare today's metrics with yesterday's data (footfall, dwell time, occupancy)
- **Interactive Charts**: 
  - Time-series occupancy visualization with live marker annotations
  - Demographic distribution (male/female) line charts and donut charts
  - Responsive chart scaling based on time of day
- **Date Selection**: View historical data for any previous date
- **Multi-site Support**: Switch between different locations with automatic data refresh

### Entry/Exit Tracking
- **Detailed Entry Logs**: Paginated table showing all entry and exit events
- **Advanced Filtering**: Filter by entry type, gender, and date range
- **Smart Caching**: Client-side data caching for instant page navigation
- **Export Ready**: Structured data format suitable for reporting

### Authentication & Security
- **JWT-based Authentication**: Secure token-based user authentication
- **Route Guards**: Protected routes requiring authentication
- **HTTP Interceptor**: Automatic token injection in API requests
- **Secure Logout**: Complete session cleanup on logout

## Technology Stack

### Frontend Framework
- **Angular 18.2** - Modern component-based architecture
- **TypeScript 5.5** - Type-safe development
- **RxJS 7.8** - Reactive programming for data streams
- **Angular Material** - UI component library

### Data Visualization
- **Chart.js 4.5** - Powerful charting library
- **ng2-charts 6.0** - Angular wrapper for Chart.js
- **chartjs-plugin-annotation 3.1** - Live marker annotations
- **chartjs-adapter-date-fns 3.0** - Time-scale support

### Real-time Communication
- **Socket.io-client 4.8** - WebSocket integration for live updates

### Additional Libraries
- **date-fns 4.1** - Modern date manipulation

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── navbar/              # Top navigation with user profile
│   │   └── alerts-sidebar/      # Alert notifications panel
│   ├── pages/
│   │   ├── login/               # Authentication page
│   │   ├── dashboard/           # Main analytics dashboard
│   │   └── crowd-entries/       # Entry/exit logs viewer
│   ├── services/
│   │   ├── auth/                # Authentication service
│   │   ├── socket.service.ts    # WebSocket connection management
│   │   ├── analytics/           # API calls for metrics
│   │   ├── dashboard-loader/    # Parallel API orchestration
│   │   ├── dashboard-cache/     # Dashboard data caching
│   │   ├── entry-exit-cache/    # Entry logs caching
│   │   ├── site/                # Site selection management
│   │   └── cleanup/             # Logout cleanup coordination
│   ├── guards/
│   │   └── auth.guard.ts        # Route protection
│   ├── models/
│   │   └── site.model.ts        # Data models
│   └── app-routing.module.ts    # Application routes
├── proxy.conf.json              # API proxy configuration
└── styles.scss                  # Global styles
```

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- Angular CLI (v18.2.21)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crowd-management-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API endpoint**
   
   The application uses a proxy configuration to connect to the backend API. Update `src/proxy.conf.json` if needed:
   ```json
   {
     "/api": {
       "target": "https://hiring-dev.internal.kloudspot.com",
       "secure": true,
       "changeOrigin": true
     }
   }
   ```

4. **Start development server**
   ```bash
   npm start
   ```
   
   Navigate to `http://localhost:4200/`

## Development

### Available Scripts

- `npm start` - Start development server with proxy
- `npm run build` - Build for production
- `npm run watch` - Build in watch mode
- `npm test` - Run unit tests

### Code Generation

Generate new components, services, or modules:
```bash
ng generate component component-name
ng generate service service-name
ng generate guard guard-name
```

## Architecture Highlights

### Performance Optimizations
- **Intelligent Caching**: Multi-layer caching system for dashboard and entry data
- **Lazy Loading**: Route-based code splitting for faster initial load
- **RxJS Operators**: Efficient data stream management with retry logic and error handling
- **Change Detection**: Optimized chart updates using immutable data patterns

### State Management
- **BehaviorSubjects**: Reactive state management for site selection and cache
- **Service-based State**: Centralized state in dedicated service layer
- **Subscription Management**: Proper cleanup in ngOnDestroy to prevent memory leaks

### Real-time Features
- **Socket.io Integration**: Live occupancy updates filtered by current site
- **Chart Annotations**: Dynamic marker positioning on time-series charts
- **Auto-refresh Mechanism**: Periodic updates to maintain data accuracy

### Error Handling
- **Retry Logic**: Exponential backoff for failed API requests (3 retries)
- **Graceful Degradation**: Fallback UI states for loading and errors
- **User Feedback**: Clear error messages and loading indicators

## API Integration

The application integrates with the following API endpoints:

- **POST /api/auth/login** - User authentication
- **POST /api/reports/footfall** - Footfall metrics
- **POST /api/reports/dwell** - Dwell time analysis
- **POST /api/reports/occupancy** - Occupancy data
- **POST /api/reports/demographics** - Gender distribution
- **POST /api/reports/entry-exit** - Entry/exit logs
- **GET /api/sites** - Available locations

WebSocket endpoint:
- **wss://hiring-dev.internal.kloudspot.com/socket.io** - Live occupancy updates

## Authentication

The system uses JWT token-based authentication:

1. User logs in with email and password
2. Server returns JWT token
3. Token stored in localStorage
4. HTTP interceptor adds token to all API requests
5. Auth guard protects dashboard and entry routes

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Build

### Development Build
```bash
npm run build
```

### Production Build
```bash
ng build --configuration production
```

Build artifacts will be stored in the `dist/` directory.

## Testing

Run unit tests:
```bash
npm test
```

Tests are executed via Karma test runner with Jasmine framework.

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## License

This project is proprietary and confidential.

## Contact

For questions or support, please contact the development team.

---

**Version**: 0.0.0  
**Last Updated**: December 2025  
**Framework**: Angular 18.2.21
