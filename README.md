# Saloon SaaS

Saalon SaaS is a complete web application for managing salon operations. Handle appointments, billing, inventory, staff, and customer reports all in one platform.

## Features

- **Appointment scheduling** - Book, reschedule, and cancel appointments with ease
- **Billing and payments** - Generate invoices, process payments, and track revenue
- **Inventory management** - Track stock levels, products, and suppliers
- **Staff management** - Manage team schedules and roles
- **Customer profiles** - Store contact info, history, and preferences
- **Reporting** - View sales, attendance, and business metrics
- **Multi-user support** - Role-based access for staff and administrators

## Tech Stack

- **Framework**: Next.js 16+ with App Router
- **Language**: TypeScript
- **Database**: Prisma ORM with PostgreSQL
- **Styling**: Tailwind CSS
- **Authentication**: Secure auth with session management
- **Deployment**: Docker-ready with configurable environment variables

## Getting Started

### Prerequisites

- Node.js 18 or later
- PostgreSQL database
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your settings
4. Run database migrations: `npx prisma migrate dev`
5. Start the development server: `npm run dev`

### Docker

Build and run with Docker Compose:

```
docker-compose up -d
```

## Environment Variables

See `.env.example` for all available variables. Key settings include:

- Database connection URL
- Authentication secrets
- API configuration
- Feature flags

## License

Private License

## Support

For documentation, tutorials, and community support, visit the project repository and discussion forums.
