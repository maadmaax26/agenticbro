# SearXNG Local Search Engine - Setup Status

## Summary

SearXNG deployment for Agentic Bro encountered bot detection issues that prevent API access. The latest version of SearXNG has a restrictive bot detection system that blocks all API requests by default.

## Current Status

- ✅ Docker installed and running
- ✅ SearXNG container created and running
- ❌ API access blocked by bot detection (403 Forbidden)

## Problem

The 403 error is caused by SearXNG's bot detection system which requires:
1. A valid `limiter.toml` configuration file
2. Proper HTTP headers (X-Forwarded-For, X-Real-IP)
3. Complex configuration that's difficult to get right for local development

## Error Details

```
403 Forbidden - You don't have the permission to access the requested resource.
```

Container logs show:
```
ERROR:searx.botdetection.config: missing config file: /etc/searxng/limiter.toml
ERROR:searx.botdetection: X-Forwarded-For nor X-Real-IP header is set!
```

## Alternative Solutions

### Option 1: Use an older SearXNG version
```bash
# Try an older version without the restrictive bot detection
docker run -d \
  --name searxng \
  --restart unless-stopped \
  -p 8888:8080 \
  -e SEARXNG_BASE_URL=http://localhost:8888/ \
  searxng/searxng:2024.1.1
```

### Option 2: Use SearXNG Docker Compose with proper configuration
Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  searxng:
    image: searxng/searxng:latest
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888/
    restart: unless-stopped
```

### Option 3: Use a different local search solution

Consider these alternatives:
- **Meilisearch**: Self-hosted search engine
- **Typesense**: Fast, typo-tolerant search engine
- **Elasticsearch**: Full-text search with more configuration options

## Recommended Next Steps

1. Try an older SearXNG version (2024.1.1) that has less restrictive bot detection
2. If SearXNG continues to have issues, consider using Meilisearch or Typesense
3. As a simpler alternative, use a local caching layer for web searches

## Files Created

- `/Users/efinney/.openclaw/workspace/memory/SEARXNG.md` - Documentation (needs updating)
- `/Users/efinney/.openclaw/workspace/scripts/searxng-search.sh` - Wrapper script (needs verification)

## Port

- **SearXNG Port**: 8888
- **API Endpoint**: http://localhost:8888/search
- **Format Parameter**: `?format=json`

## Next Debug Steps

1. Try SearXNG version 2024.1.1
2. If that fails, consider using a different search solution
3. Alternatively, use a proxy service to forward requests
