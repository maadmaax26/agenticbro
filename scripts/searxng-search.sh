#!/bin/bash
# SearXNG search wrapper for Agentic Bro
# Usage: bash scripts/searxng-search.sh "search query" [count]

QUERY="$1"
COUNT="${2:-10}"

if [ -z "$QUERY" ]; then
  echo '{"error": "No query provided", "results": []}'
  exit 1
fi

# URL encode the query
ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$QUERY'''))")

# Call SearXNG API
curl -s "http://localhost:8888/search?q=${ENCODED_QUERY}&format=json&engines=google,bing,duckduckgo&pageno=1" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
results = []
for r in data.get('results', [])[:int('$COUNT')]:
    results.append({
        'title': r.get('title', ''),
        'url': r.get('url', ''),
        'description': r.get('content', ''),
        'engine': r.get('engine', '')
    })
print(json.dumps({'query': '$QUERY', 'count': len(results), 'results': results}, indent=2))
"
