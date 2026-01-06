# Demo VN Control

Control AGV VisionNav System - A web-based control system for AGV (Automated Guided Vehicle) management.

## Features

- **Manual & Operate**: Manual control and operation of AGVs
- **Auto Condition**: Automated condition flow management
- **Monitor**: Real-time monitoring with customizable nodes (Lamp, Counter, Park, Map, Battery, Date)
- **Settings**: System configuration and settings
- **Logs**: System activity logs
- **Error Message**: Error tracking and management

## Tech Stack

- **Frontend**: React 18, Vite, React Router, ReactFlow
- **Backend**: Node.js, Express, MySQL
- **Icons**: React Icons

## Prerequisites

- Node.js (v16 or higher)
- MySQL Database
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Demo_VN_control
```

2. Install dependencies:
```bash
npm install
```

3. Configure database:
   - Update database configuration in `proxy-server.js`
   - Run SQL scripts if needed (see `fix_iot_table.sql`)

4. Start the development server:
```bash
# Start proxy server and dev server together
npm run dev:proxy

# Or start separately:
npm run proxy    # Start proxy server
npm run dev      # Start Vite dev server
```

## Default Login Credentials

- **Admin**: 
  - Username: `admin`
  - Password: `admin`
  - Access: Full system access

- **User**: 
  - Username: `user`
  - Password: `1234`
  - Access: Monitor, Logs, Error Message only

## Project Structure

```
Demo_VN_control/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/         # Page components
│   └── styles/         # CSS styles
├── public/            # Static assets
├── proxy-server.js    # Backend proxy server
└── package.json       # Dependencies
```

## Development

- Frontend runs on: `http://localhost:5173`
- Backend API runs on: `http://localhost:4000`

## Build for Production

```bash
npm run build
```

## License

Private project

