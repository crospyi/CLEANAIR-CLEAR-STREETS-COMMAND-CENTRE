# MCD Delhi - CleanAir Command Centre Dashboard

A modern React & TypeScript web application designed for municipal government authorities (MCD Delhi) to monitor, manage, and coordinate responses to environmental reports submitted by citizens.

- **Live Dashboard**: https://crospyi.github.io/CLEANAIR-CLEAR-STREETS-COMMAND-CENTRE/
- **Associated Citizen Portal**: https://crospyi.github.io/clean-air-citizen-portal-/

## Features

- **Live Incidents Monitor**: Track real-time citizen-submitted air quality and pollution reports.
- **Interactive Map**: View geolocated incidents across Delhi's municipal zones using Leaflet maps.
- **AI-Powered Analytics**: Integrated Gemini-based insights for predictive pollution modeling and severity assessment.
- **Staff Coordination**: Assign tasks to field staff, coordinate cleanups, and track task status.

## Run Locally

### Prerequisites
- Node.js (v18 or higher recommended)

### Setup & Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory (based on `.env` or sample keys) and configure your API keys:
   ```env
   VITE_GEMINI_API_KEY="your-gemini-api-key"
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3001](http://localhost:3001) in your browser to view the application.

4. **Build for Production**:
   ```bash
   npm run build
   ```
