# Crowd Management System

A robust, real-time analytics dashboard designed for monitoring crowd occupancy, dwell time, and footfall in public venues. This application provides a unified interface for stakeholders to view live data, historical trends, and visitor demographics.

## Key Features

* **Real-Time Analytics:** Live occupancy updates powered by Socket.io connectivity.
* **Interactive Visualizations:** Dynamic line and doughnut charts for visualizing crowd trends and demographics.
* **Secure Authentication:** JWT-based login system with secure route guarding.
* **Responsive Interface:** The application features a highly responsive layout capable of adapting to all desktop and laptop resolutions. It utilizes Material UI design principles to ensure a modern, accessible, and consistent user experience across devices.
* **Data-Driven:** Full integration with backend APIs for footfall, dwell time, and entry/exit logs.

## Tech Stack

* **Framework:** Angular 18+
* **Styling:** SCSS, Bootstrap 5 (with Material Design aesthetics)
* **Charts:** Chart.js, ng2-charts
* **State Management:** RxJS

## Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

Ensure you have the following installed:
* **Node.js** (v18 or higher)
* **npm** (Node Package Manager)
* **Angular CLI:** Install globally via `npm install -g @angular/cli`

### Installation Process

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/crowd-management-system.git](https://github.com/your-username/crowd-management-system.git)
    cd crowd-management-system
    ```

2.  **Install dependencies:**
    This will download all required libraries including Angular core, Chart.js, and styling packages.
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm start
    ```

4.  **Access the Application:**
    Open your web browser and navigate to `https://kloudspot-crowd-management.netlify.app/`. The application will automatically reload if you change any source files.
    Production Link: https://kloudspot-crowd-management.netlify.app/

