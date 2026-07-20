# Agentic Bro API

AI-powered scam detection and profile verification for Solana.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (for local development)
- Redis 7+ (for local development)

### Using Docker (Recommended)

```bash
# Clone the repository
cd agentic-bro

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
nano .env

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f api

# Run migrations
docker-compose exec postgres psql -U agenticbro -d agenticbro -f /docker-entrypoint-initdb.d/001_initial_schema.sql
```

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run database migrations
psql -h localhost -U agenticbro -d agenticbro -f db/migrations/001_initial_schema.sql

# Start development server
npm run dev
```

## 📁 Project Structure

```
agentic-bro/
├── src/
│   └── index.ts              # Express server entry point
├── services/
│   └── profile-verifier/     # Profile verification service
│       ├── index.ts          # Main verifier logic
│       └── scoring.ts        # Authenticity calculator
├── routes/
│   └── verify.ts             # API routes
├── middleware/
│   ├── auth.ts               # API key authentication
│   └── rate-limiter.ts      # Tiered rate limiting
├── clients/
│   └── twitter.ts            # Twitter API client
├── db/
│   ├── migrations/           # Database migrations
│   │   └── 001_initial_schema.sql
│   └── scammer-db.ts         # Scammer database client
├── utils/
│   ├── cache.ts              # Redis cache utility
│   └── deepfake.ts           # Deepfake detection
├── workers/
│   └── index.ts              # Background worker
├── docker-compose.yml        # Docker services
├── Dockerfile                # API container
├── Dockerfile.worker         # Worker container
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── .env.example              # Environment template
```

## 🔌 API Endpoints

### Authentication

All endpoints require an API key in the `Authorization` header:

```
Authorization: Bearer ab_your_api_key_here
```

Or in the `X-API-Key` header:

```
X-API-Key: ab_your_api_key_here
```

### Profile Verification

#### `POST /api/v1/verify/profile`

Verify a social media profile.

```json
{
  "platform": "twitter",
  "username": "elonmusk",
  "options": {
    "deepScan": true,
    "includeMedia": true
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "profile": { ... },
    "authenticityScore": 98,
    "riskLevel": "VERIFIED",
    "categories": { ... },
    "recommendation": "✅ VERIFIED ACCOUNT..."
  }
}
```

#### `GET /api/v1/verify/profile/:username/scammers`

Check if username matches known scammers.

#### `POST /api/v1/scammers/report`

Report a scammer.

#### `GET /api/v1/scammers/search`

Search scammer database.

### Token Scanning

#### `POST /api/v1/scan/token`

Scan a token by contract address.

```json
{
  "contractAddress": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
  "chain": "solana"
}
```

## 🔑 Rate Limits

| Tier | Scans/Day | Verifications/Day | Price |
|------|-----------|-------------------|-------|
| Free | 5 | 3 | $0 |
| Basic | 50 | 25 | $29/mo |
| Pro | 200 | 100 | $99/mo |
| Team | 1000 | 500 | $299/mo |
| Enterprise | Unlimited | Unlimited | $999/mo |

## 🗄️ Database Schema

### Core Tables

- **users** - User accounts
- **api_keys** - API key management
- **known_scammers** - Scammer database
- **verified_accounts** - Whitelisted accounts
- **token_scan_history** - Token scan records
- **profile_verification_history** - Profile verification records
- **scammer_reports** - Community reports

See `db/migrations/001_initial_schema.sql` for full schema.

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| api | 3002 | REST API server |
| worker | - | Background task processor |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Cache & task queue |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | API port | 3002 |
| DATABASE_URL | PostgreSQL connection | - |
| REDIS_URL | Redis connection | - |
| TWITTER_API_KEY | Twitter API key | - |
| TWITTER_API_SECRET | Twitter API secret | - |
| TWITTER_BEARER_TOKEN | Twitter bearer token | - |
| BOTOMETER_API_KEY | Botometer API key | - |
| GOPUS_API_KEY | GoPlus API key | - |
| DEXSCREENER_API_KEY | DexScreener API key | - |

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3002/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-30T17:00:00Z",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Prometheus Metrics

Metrics available at `:9090/metrics` (when configured).

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 🆘 Support

- **Documentation:** https://docs.agenticbro.app
- **Discord:** https://discord.gg/agenticbro
- **Email:** support@agenticbro.app