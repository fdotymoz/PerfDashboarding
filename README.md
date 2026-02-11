# Performance Dashboard

A modern, interactive dashboard for tracking bugs, benchmark scores, and team component ownership.

## Features

- **Bug Tracking**: Visualize bugs by severity with interactive charts
- **Benchmark Scores**: Track performance trends over time
- **Team Breakdown**: Monitor component ownership across teams
- **Responsive Design**: Works on desktop and mobile devices
- **Easy Navigation**: Simple tab-based interface for different views

## Tech Stack

- **React 18**: Modern UI library
- **Vite**: Fast build tool and dev server
- **Chart.js**: Powerful charting library
- **react-chartjs-2**: React wrapper for Chart.js

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Project Structure

```
src/
├── components/
│   ├── Dashboard.jsx    # Main dashboard component
│   └── Dashboard.css    # Dashboard styles
├── App.jsx              # Root component
├── App.css              # App styles
├── main.jsx             # Entry point
└── index.css            # Global styles
```

## Customization

The dashboard currently uses sample data. To connect real data:

1. Replace the sample data in `src/components/Dashboard.jsx`
2. Add data fetching logic (API calls, database queries)
3. Update chart configurations as needed

## Future Enhancements

- [ ] Connect to real data sources
- [ ] Add filtering and search capabilities
- [ ] Implement data export functionality
- [ ] Add more chart types and visualizations
- [ ] User authentication and personalization
- [ ] Real-time data updates

## License

MIT
