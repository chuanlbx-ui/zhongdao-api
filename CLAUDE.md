# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **中道商城系统** (Zhongdao Mall System) - a multi-level supply chain social e-commerce platform built with Node.js, TypeScript, Express, and MySQL. It's a complex business system with features like:

- **Multi-level user hierarchy**: Normal users → VIP → 1-5 star shop managers → Directors
- **Dual shop system**: Cloud shops (performance-based) + Five-element shops (special privileges)
- **Complex procurement rules**: Level restrictions + intermediate performance + peer rewards
- **Dual warehouse inventory**: Cloud warehouse (team shared) + Local warehouse (personal)
- **Points/credit system**: Multi-source circulation from procurement, transfers, and platform recharges

## Key Development Commands

### Development
```bash
# Start development server with hot reload
npm run dev
# Alternative development start
npm run start:dev

# Build the project
npm run build

# Start production server
npm run start
```

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Push database schema changes
npm run db:push

# Run database migrations
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed database with initial data
npm run db:seed
```

### Testing
```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Watch mode for tests
npm run test:watch
```

### Code Quality
```bash
# Lint TypeScript code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking without compilation
npm run type-check

# Format code with Prettier
npm run format
```

### Docker Operations
```bash
# Start development environment
npm run docker:dev

# Start production environment
npm run docker:prod

# Stop all containers
npm run docker:down
```

## Architecture Overview

### Project Structure
- **`src/modules/`**: Business logic modules (user, shop, purchase, inventory, points, etc.)
- **`src/shared/`**: Shared utilities, middleware, database client, types
- **`src/routes/v1/`**: API v1 route handlers organized by feature
- **`prisma/`**: Database schema and migrations
- **`src/config/`**: Configuration files (payments, etc.)

### Key Business Modules

1. **User Management** (`src/modules/user/`)
   - Multi-level hierarchy system
   - Team structure and relationships
   - Performance tracking

2. **Shop Management** (`src/modules/shop/`)
   - Dual shop types (Cloud + Five-element)
   - Shop level management
   - Performance metrics

3. **Purchase System** (`src/modules/purchase/`)
   - Complex procurement rules with level restrictions
   - Commission calculations
   - Supply chain management

4. **Inventory Management** (`src/modules/inventory/`)
   - Dual warehouse system (Cloud + Local)
   - Real-time stock tracking
   - Alert system for low stock

5. **Points/Credits System** (`src/shared/services/points.ts`)
   - Multi-source points circulation
   - Transaction tracking
   - Transfer and recharge functions

### Database Design
The Prisma schema reveals a sophisticated multi-tenant architecture:
- **User hierarchy** with team paths and relationships
- **Complex product catalog** with categories, specs, and differential pricing
- **Inventory management** across multiple warehouse types
- **Transaction system** for points/credits with detailed audit trails
- **Notification system** with multiple channels and templates

### API Architecture
- **RESTful APIs** under `/api/v1/`
- **Modular route structure** organized by business domain
- **Comprehensive middleware stack** for security, validation, and monitoring
- **Health check endpoints** at `/health`, `/health/database`, `/health/redis`, `/health/security`

### Security Features
- **JWT-based authentication** with role-based access control
- **Multi-layer security middleware** (helmet, CORS, rate limiting, CSRF protection)
- **Input validation** and XSS protection
- **Security monitoring** and IP blacklisting
- **File upload security** protections

## Important Development Notes

### Environment Configuration
- Uses environment-specific `.env` files (`.env.development`, `.env.production`, etc.)
- Database connection via `DATABASE_URL` environment variable
- Payment system requires proper configuration for WeChat Pay and Alipay

### Business Logic Complexity
This is not a typical e-commerce platform - key differences:
- **Multi-level marketing (MLM) structure** with complex commission calculations
- **Team-based procurement rules** where users can only buy from higher levels
- **Points-based economy** that functions as internal currency
- **Dual inventory system** serving different business purposes

### Database Schema Understanding
- **User levels**: NORMAL → VIP → STAR_1 to STAR_5 → DIRECTOR
- **Shop types**: CLOUD (performance-based) vs WUTONG (one-time purchase)
- **Warehouse types**: PLATFORM, CLOUD (team shared), LOCAL (personal)
- **Transaction types**: PURCHASE, TRANSFER, RECHARGE, WITHDRAW, COMMISSION, etc.

### Testing Strategy
- **Unit tests** for individual business logic functions
- **Integration tests** for complete business workflows
- **E2E tests** for critical user journeys
- **Coverage targets**: >80% for unit tests, >70% for integration tests

### Performance Considerations
- **Database indexing** on frequently queried fields (user levels, order statuses, transaction dates)
- **Redis caching** for user sessions, product info, inventory data
- **API rate limiting** to prevent abuse
- **Compression middleware** for response optimization

## Development Workflow

1. **Setup**: Run `npm install` and configure environment variables
2. **Database**: Run `npm run db:generate && npm run db:push`
3. **Development**: Use `npm run dev` for hot reloading
4. **Testing**: Run `npm test` before committing
5. **Code Quality**: Ensure `npm run lint` and `npm run type-check` pass
6. **Build**: Use `npm run build` for production deployment

## AI Collaboration Support

The project includes AI collaboration features with specialized agents:
- **Coordinator AI**: Project management and task allocation
- **Architect AI**: System design and technical decisions
- **User System AI**: Authentication and user management
- **Shop System AI**: Shop functionality and inventory
- **Test AI**: Quality assurance and testing
- **Documentation AI**: Technical documentation

When working on this codebase, always consider the complex business rules and multi-level hierarchy that make this system unique compared to standard e-commerce platforms.
- 记住：本项目的前端H5开发目录是在D:/wwwroot/zhongdao-H5/
- 后台管理系统是在 D:\wwwroot\zhongdao-admin 目录