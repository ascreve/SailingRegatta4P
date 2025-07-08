
# Sailing Race Game

A real-time 2D sailing race game built with React, Express, and PostgreSQL. Players can race against each other in various weather conditions and locations.

## Features

- Real-time sailing physics simulation
- Multiple race locations
- Dynamic wind conditions
- User authentication and profiles
- Race statistics and leaderboards
- Responsive design for all devices

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- Radix UI components
- Zustand for state management
- React Router for navigation

**Backend:**
- Express.js with TypeScript
- PostgreSQL with Drizzle ORM
- Session-based authentication
- WebSocket support for real-time features

**Development:**
- Vite for fast development
- ESBuild for production builds
- TypeScript for type safety

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/sailing-race-game.git
cd sailing-race-game
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your database URL and other configuration
```

4. Set up the database
```bash
npm run db:push
```

5. Start the development server
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - Type check TypeScript
- `npm run db:push` - Push database schema

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/           # Utilities and stores
│   │   └── pages/         # Page components
├── server/                # Express backend
│   ├── services/          # Business logic
│   └── routes.ts         # API routes
├── shared/               # Shared TypeScript types
└── scripts/             # Utility scripts
```

## Deployment

This project is optimized for deployment on Replit, but can be deployed anywhere that supports Node.js applications.

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string for development
- `PROD_DATABASE_URL` - PostgreSQL connection string for production
- `NODE_ENV` - Set to 'production' for production builds

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
