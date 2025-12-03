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

# Seed with different data sizes
npm run db:seed:minimal
npm run db:seed:standard
npm run db:seed:comprehensive

# Database management utilities
npm run db:clean    # Clean test data
npm run db:stats    # View database statistics
npm run db:validate # Validate data integrity
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

# Admin system testing
npm run test:admin              # Run admin compatibility tests
npm run test:admin:report       # Generate and open test report
npm run test:admin:verbose      # Verbose admin testing
npm run test:admin:api          # Test API connectivity
npm run test:admin:db           # Test database connectivity
npm run admin:diagnostic        # Full admin diagnostic check
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

### Remote Development & Deployment
```bash
# Remote execution
npm run remote:exec
npm run remote:deploy
npm run remote:status
npm run remote:logs
npm run remote:restart

# SSH Tunnel Management
npm run tunnel:start
npm run tunnel:stop
npm run tunnel:status
npm run tunnel:restart

# Environment Switching
npm run env:switch-local   # Switch to local environment
npm run env:switch-remote  # Switch to remote development
npm run env:switch-prod    # Switch to production
npm run env:list           # List available environments

# Deployment configuration
npm run deploy:config-fix
npm run deploy:config-check
```

### Documentation
```bash
# Open API documentation in browser
npm run docs:open

# Export API documentation to JSON
npm run docs:json
```

### Admin Setup
```bash
# Quick admin setup (migrate + seed)
npm run admin:setup
```

## Architecture Overview

### Project Structure
- **`src/modules/`**: Business logic modules (user, shop, purchase, inventory, points, team, products, etc.)
- **`src/shared/`**: Shared utilities, middleware, database client, types, services
- **`src/routes/v1/`**: API v1 route handlers organized by feature
- **`prisma/`**: Database schema and migrations
- **`src/config/`**: Configuration files (payments, swagger, etc.)
- **`scripts/`**: Utility scripts for deployment, testing, and data management
- **`docs/`**: Documentation files and guides
- **`tests/`**: Comprehensive test suite with setup, helpers, mocks, and API tests

### Testing System Architecture
The project includes a comprehensive testing infrastructure designed for both frontend and backend validation:

#### Frontend Testing (H5 Application)
- **Location**: `D:\wwwroot\zhongdao-H5\` with React/Vue + TypeScript setup
- **Key Testing Files**:
  - `src/test/setup.ts` - Test environment configuration
  - `src/test/components/` - Component test suites
  - `vite.config.ts` - Test configuration with alias resolution

#### Backend API Testing
- **Location**: `tests/` directory with comprehensive API endpoint testing
- **Infrastructure Components**:
  - `tests/setup.ts` - Express app instance, database connection, global utilities
  - `tests/helpers/auth.helper.ts` - JWT token generation, multi-level user authentication
  - `tests/database/test-database.helper.ts` - Test database isolation, cleanup, seeding
  - `tests/mocks/external.services.mock.ts` - WeChat, payment, SMS, email service mocking
  - `tests/config/test-security.config.ts` - Test-specific security middleware

#### Key Testing Features
- **Multi-Level User Testing**: Support for all user hierarchy levels (NORMAL, VIP, STAR_1-5, DIRECTOR)
- **Database Isolation**: Separate test database with automatic cleanup
- **External Service Mocking**: Complete mocking of WeChat, payments, SMS, email services
- **Security Configuration**: Test-specific security settings bypassing production restrictions
- **Comprehensive Assertions**: Custom helpers for API responses, JWT tokens, UUIDs, etc.

### Key Business Modules

1. **User Management** (`src/modules/user/`, `src/routes/v1/users/`, `src/routes/v1/auth/`)
   - Multi-level hierarchy system (NORMAL → VIP → STAR_1-5 → DIRECTOR)
   - Team structure and relationships with parent/child mapping
   - Performance tracking and level progression
   - WeChat integration for authentication

2. **Shop Management** (`src/modules/shop/`, `src/routes/v1/shops/`)
   - Dual shop types: Cloud shops (performance-based) + Five-element shops (one-time purchase)
   - Shop level management with upgrade requirements
   - Performance metrics and commission calculations

3. **Team Management** (`src/modules/team/`, `src/routes/v1/teams/`)
   - Network relationship building and management
   - Performance metrics tracking
   - Commission calculations and distribution
   - Team structure visualization and analytics

4. **Product Management** (`src/modules/products/`, `src/routes/v1/products/`)
   - Product catalog with categories and tags
   - Differential pricing based on user levels
   - Specifications and inventory management
   - Product status and availability control

5. **Purchase System** (`src/modules/purchase/`, `src/routes/v1/orders/`)
   - Complex procurement rules with level restrictions
   - Supply chain path validation
   - Order creation and management
   - Purchase permission validation

6. **Inventory Management** (`src/modules/inventory/`, `src/routes/v1/inventory/`)
   - Dual warehouse system: Cloud warehouse (team shared) + Local warehouse (personal)
   - Real-time stock tracking and alerts
   - Inventory adjustments and transfers
   - Damage reporting and stock reconciliation

7. **Points/Credits System** (`src/shared/services/points.ts`, `src/routes/v1/points/`)
   - Multi-source points circulation (purchases, transfers, recharges)
   - Transaction tracking and audit trails
   - Transfer and recharge functions
   - Balance management and freezing capabilities

8. **Payment System** (`src/modules/payment/`, `src/routes/v1/payments/`)
   - WeChat Pay and Alipay integration
   - Points-based payment processing
   - Refund management and approval workflows
   - Payment logging and audit trails

9. **Commission System** (`src/routes/v1/commission/`)
   - Complex commission calculation algorithms
   - Multi-level distribution tracking
   - Settlement and payment processing
   - Performance-based commission tiers

### Database Design
The Prisma schema reveals a sophisticated multi-tenant architecture with comprehensive business logic:

#### Core Entity Relationships
- **User hierarchy**: Multi-level parent-child relationships with team paths and referral codes
- **Complex product catalog**: Categories, tags, specifications with differential pricing
- **Inventory management**: Multi-warehouse system (Platform, Cloud, Local) with real-time tracking
- **Transaction system**: Points/credits with detailed audit trails and multiple transaction types
- **Notification system**: Multi-channel delivery with templates and preferences

#### Key Database Models
- **User**: Core user entity with level progression, team relationships, and performance metrics
- **Shop**: Dual shop system (Cloud + Five-element) with level-based permissions
- **PointsTransaction**: Comprehensive transaction tracking with audit trails
- **InventoryItem/Stock**: Multi-warehouse inventory with real-time synchronization
- **CommissionCalculation**: Complex commission distribution algorithms
- **SystemConfig**: Dynamic configuration management with runtime updates

#### Database Indices and Performance
- Strategic indexing on frequently queried fields (user levels, order statuses, dates)
- Composite indexes for complex business queries
- Foreign key relationships ensuring data integrity

### API Architecture
- **RESTful APIs** under `/api/v1/` with comprehensive business domain coverage
- **Modular route structure**: auth, users, shops, products, orders, payments, points, inventory, teams, commission
- **Comprehensive middleware stack**: Security, validation, rate limiting, CSRF protection, file upload security
- **Health check endpoints**: `/health`, `/health/database`, `/health/redis`, `/health/security`
- **Swagger/OpenAPI documentation**: Auto-generated with interactive UI at `/api-docs`
- **Admin management routes**: Dedicated admin endpoints for system configuration and user management

### Security Features
- **JWT-based authentication** with role-based access control and refresh tokens
- **Multi-layer security middleware**: Helmet, CORS, rate limiting, CSRF protection, enhanced security headers
- **Input validation and sanitization**: XSS protection, SQL injection prevention, enhanced input validation
- **Security monitoring and threat detection**: IP blacklisting, suspicious behavior detection, security event logging
- **File upload security**: Type validation, size limits, malicious file detection
- **Runtime configuration validation**: Security configuration service with startup checks
- **Environment-based security**: Different security profiles for development vs production

## Important Development Notes

### Environment Configuration
- **Multiple environment files**: `.env.development`, `.env.production`, `.env.remote-dev` with easy switching via npm scripts
- **Runtime environment loading**: `src/init-env.ts` ensures environment variables are loaded before any other imports
- **Database connection**: MySQL via `DATABASE_URL` with connection pooling and health checks
- **Payment system configuration**: WeChat Pay and Alipay with dynamic config loading and validation

### Business Logic Complexity
This is not a typical e-commerce platform - key differences:
- **Multi-level marketing (MLM) structure**: Complex commission calculations with team-based distribution
- **Hierarchical procurement rules**: Users can only purchase from higher-level team members with validation algorithms
- **Points-based internal economy**: Multi-source circulation system functioning as internal currency
- **Dual inventory management**: Cloud warehouses (team sharing) + Local warehouses (personal) with different business logic
- **Dynamic configuration system**: Runtime-updatable business rules and level requirements

### Database Schema Understanding
- **User progression**: NORMAL → VIP → STAR_1 to STAR_5 → DIRECTOR with performance-based upgrades
- **Shop system**: CLOUD shops (performance progression) vs WUTONG shops (one-time purchase with special privileges)
- **Multi-warehouse inventory**: PLATFORM (system), CLOUD (team shared), LOCAL (personal) with transfer capabilities
- **Transaction ecosystem**: PURCHASE, TRANSFER, RECHARGE, WITHDRAW, COMMISSION, GIFT with full audit trails
- **Team network modeling**: Parent-child relationships with team paths for efficient querying

### Testing and Quality Assurance

#### Test Infrastructure Usage

**Backend API Testing:**
```bash
# Run all API tests
npm test

# Run specific test suites
npm run test:api
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Admin system testing
npm run test:admin
npm run admin:diagnostic
```

**Frontend Testing:**
```bash
# From H5 directory
cd ../zhongdao-H5
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
```

**Test Usage Patterns:**
```typescript
// Basic API test example
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../setup';

describe('User Authentication', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should authenticate admin user', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set(getAuthHeadersForUser('admin'))
      .expect(200);

    expect(response.body.data.role).toBe('ADMIN');
  });
});
```

**Test Data Management:**
```typescript
// Get test users with different permission levels
const adminUser = getTestUser('admin');
const normalUser = getTestUser('normal');
const vipUser = getTestUser('vip');

// Generate test data
const testData = generateTestData();

// Use test agent for authenticated requests
const agent = createTestAgent(app).asUser('admin');
```

**Quality Assurance Features:**
- **Comprehensive test suite**: Unit tests for business logic, integration tests for workflows, E2E tests for critical user journeys
- **Admin system testing**: Specialized compatibility tests with detailed reporting and diagnostics
- **Coverage targets**: >80% for unit tests, >70% for integration tests with automated reporting
- **Test data management**: Multiple seed configurations (minimal, standard, comprehensive) with validation utilities
- **Multi-level user testing**: Support for all user hierarchy levels (NORMAL, VIP, STAR_1-5, DIRECTOR)
- **Database isolation**: Separate test database with automatic cleanup
- **External service mocking**: Complete mocking of WeChat, payments, SMS, email services

### Performance and Scalability
- **Strategic database indexing**: Optimized for complex hierarchical queries and business logic
- **Memory-based caching**: In-memory caching system (Redis disabled in production) for user sessions and frequently accessed data
- **API rate limiting**: Multi-tier rate limiting to prevent abuse while ensuring business functionality
- **Response optimization**: Compression middleware and optimized query patterns for fast API responses
- **Health monitoring**: Comprehensive health checks for database, security status, and system performance

### Development Workflow Enhancements
- **Remote development support**: SSH tunneling and remote execution capabilities for distributed development
- **Automated deployment**: Configuration management and deployment validation scripts
- **Admin management tools**: Built-in admin interface for system configuration and user management
- **API documentation**: Auto-generated Swagger documentation with interactive testing capabilities

## Development Workflow

### Quick Start (New Developers)
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
npm run env:switch-local  # or env:switch-remote for remote development

# 3. Database setup
npm run db:generate && npm run db:push

# 4. Quick admin setup
npm run admin:setup

# 5. Start development
npm run dev
```

### Daily Development Cycle
1. **Environment management**: Use `npm run env:list` to see available environments
2. **Database operations**: Use `npm run db:validate` to check data integrity before major changes
3. **Development**: Use `npm run dev` for hot reloading with comprehensive middleware
4. **Testing**: Run `npm run test:admin` for admin system validation before commits
5. **Code Quality**: Ensure `npm run lint` and `npm run type-check` pass
6. **Documentation**: Access API docs at `http://localhost:3000/api-docs` during development

### Production Deployment
```bash
# 1. Build and validate
npm run build && npm run deploy:config-check

# 2. Deploy to production
npm run remote:deploy

# 3. Verify deployment
npm run remote:status && npm run admin:diagnostic
```

## Frontend Development

### Mobile H5 Application
- **Location**: `D:/wwwroot/zhongdao-H5/`
- **Framework**: React/Vue with TypeScript (check package.json for specifics)
- **API Integration**: Connects to this backend at `/api/v1/`

### Admin Management System
- **Location**: `D:\wwwroot\zhongdao-admin/`
- **Framework**: Vue 3 + TypeScript + Element Plus
- **Access**: Uses dedicated admin routes under `/api/v1/admin/`

## AI Collaboration Support

The project includes AI collaboration features with specialized agents for complex development tasks:
- **Coordinator AI**: Project management, task allocation, and conflict resolution
- **Architect AI**: System design, technical decisions, and database architecture
- **User System AI**: Authentication, user management, and team hierarchy logic
- **Shop System AI**: Shop functionality, inventory management, and commission calculations
- **Test AI**: Quality assurance, testing strategy, and admin system validation
- **Documentation AI**: Technical documentation, API specs, and development guides

## Critical Business Rules

When working on this codebase, always consider these unique business characteristics:

### Multi-Level Hierarchy Logic
- Users can only purchase from higher-level team members
- Commission distribution follows complex multi-level algorithms
- Team performance affects individual upgrade eligibility

### Dual Economic Systems
- **Points system**: Internal currency for purchases and transfers
- **Real money**: For recharges, withdrawals, and commission payments
- Complex conversion rules between the two systems

### Inventory Complexity
- **Cloud warehouses**: Shared among team members with permission rules
- **Local warehouses**: Personal inventory with different business logic
- Real-time synchronization between warehouse types

### Dynamic Configuration
- Many business rules are runtime-configurable via `SystemConfig`
- Level requirements and commission rates can be adjusted without deployment
- All configuration changes are logged and auditable

Remember: This is not a standard e-commerce platform. The multi-level marketing structure, complex commission calculations, and dual inventory systems require careful consideration when making changes to any business logic.