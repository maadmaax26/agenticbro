# SearXNG Self-Hosted Search

## Overview

SearXNG is a self-hosted metasearch engine that aggregates results from Google, Bing, DuckDuckGo, and other search engines. This replaces the rate-limited Brave Search API for Agentic Bro web searches.

## Configuration

| Setting | Value |
|---------|-------|
| **Container** | `searxng/searxng:latest` |
| **Port** | 8888 |
| **Config Dir** | `~/.openclaw/searxng/` |
| **API Endpoint** | `http://localhost:8888/search?q={query}&format=json` |

## Usage

### Direct API

```bash
curl "http://localhost:8888/search?q=your+query&format=json&engines=google,bing,duckduckgo"
```

### Wrapper Script

```bash
bash /Users/efinney/.openclaw/workspace/scripts/searxng-search.sh "search query" [count]
```

- `query`: Search terms (required)
- `count`: Number of results (default: 10, max: 20)

### Output Format

```json
{
  "query": "search query",
  "count": 5,
  "results": [
    {
      "title": "Result title",
      "url": "https://example.com",
      "description": "Result snippet...",
      "engine": "google"
    }
  ]
}
```

## Management

### Start/Stop/Restart

```bash
docker start searxng
docker stop searxng
docker restart searxng
```

### View Logs

```bash
docker logs searxng
docker logs -f searxng  # Follow mode
```

### Rebuild

```bash
docker stop searxng && docker rm searxng
docker run -d --name searxng --restart unless-stopped \
  -p 8888:8080 \
  -v ~/.openclaw/searxng:/etc/searxng:rw \
  -e SEARXNG_BASE_URL=http://localhost:8888/ \
  searxng/searxng:latest
```

## Features

- **No rate limits** — Your own instance, unlimited searches
- **Aggregated results** — Combines Google, Bing, DuckDuckGo, Wikipedia
- **Privacy** — No tracking, no API keys
- **Free** — Only cost is hosting (Mac Studio already running)
- **JSON API** — Easy integration with Agentic Bro

## Enabled Engines

- Google (`g`)
- Bing (`b`)
- DuckDuckGo (`ddg`)
- Wikipedia (`wp`)

## Configuration File

Location: `~/.openclaw/searxng/settings.yml`

Key settings:
- `limiter: false` — No rate limiting
- `formats: [html, json, csv, rss]` — JSON output enabled
- `safe_search: 0` — Unfiltered results

## Integration with Agentic Bro

The wrapper script at `/Users/efinney/.openclaw/workspace/scripts/searxng-search.sh` provides a simple interface for web searches from Agentic Bro scans and investigations.

## Troubleshooting

### 403 Forbidden

If you get a 403 error, ensure `limiter: false` is set in `settings.yml` and restart the container.

### No Results

Some engines may fail to initialize on first run. Wait a few seconds and retry. The container needs time to connect to upstream search engines.

### Container Not Starting

```bash
docker logs searxng
```

Check for port conflicts: `lsof -i :8888`

---

**Installed:** 2026-06-07
**Status:** Operational