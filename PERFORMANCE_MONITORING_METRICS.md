# Multi-Agent Performance Monitoring Metrics

## Date
2026-03-27 22:04 EDT

## Purpose
Track and monitor performance metrics for the multi-agent routing system to ensure optimal operation and identify bottlenecks.

## Metrics Overview

### Key Performance Indicators (KPIs)

| Category | Metric | Target | Current | Status |
|----------|--------|--------|---------|--------|
| **Availability** | Uptime | > 99% | TBD | ⏳ |
| **Performance** | Simple query response time | < 1s | TBD | ⏳ |
| **Performance** | X profile scan time | < 3s | TBD | ⏳ |
| **Performance** | Complex operation time | < 10s | TBD | ⏳ |
| **Reliability** | Delegation success rate | > 95% | TBD | ⏳ |
| **Capacity** | Concurrent sessions | < 100 | TBD | ⏳ |
| **Efficiency** | Agent utilization | 60-80% | TBD | ⏳ |

---

## Metrics Categories

### 1. Delegation Metrics

#### Delegation Success Rate
- **Definition:** Percentage of successful delegations vs attempted delegations
- **Formula:** `(successful_delegations / total_delegations) × 100`
- **Target:** > 95%
- **Alert Threshold:** < 90%

#### Delegation Failure Rate
- **Definition:** Percentage of failed delegations
- **Formula:** `(failed_delegations / total_delegations) × 100`
- **Target:** < 5%
- **Alert Threshold:** > 10%

#### Delegation by Agent
- **Definition:** Distribution of delegations by target agent
- **Formula:** Count per agent / total delegations
- **Target:** Balanced load per specialization
- **Alert Threshold:** Single agent > 60% of load (if multiple available)

#### Delegation by Operation
- **Definition:** Distribution of delegations by operation type
- **Formula:** Count per operation / total delegations
- **Target:** Match expected traffic patterns
- **Alert Threshold:** Unexpected spikes in any operation type

### 2. Response Time Metrics

#### Average Response Time (Per Agent)
- **Definition:** Average time from delegation request to response
- **Formula:** `sum(response_times) / count(responses)`
- **Targets:**
  - query-router-1/2: < 1s
  - web-scraper (API): < 1s
  - web-scraper (browser): < 3s
  - telegram-manager: < 2s
  - file-manager: < 2s
  - complex-op-agent-1/2: < 10s
- **Alert Thresholds:** 2× target

#### p50 Response Time (Median)
- **Definition:** Median response time
- **Formula:** 50th percentile of response times
- **Targets:** Same as average
- **Alert Thresholds:** Same as average

#### p95 Response Time
- **Definition:** 95th percentile of response times
- **Formula:** 95th percentile of response times
- **Targets:** 1.5× average target
- **Alert Thresholds:** 2× average target

#### p99 Response Time
- **Definition:** 99th percentile of response times
- **Formula:** 99th percentile of response times
- **Targets:** 2× average target
- **Alert Thresholds:** 3× average target

#### Response Time by Operation
- **Definition:** Average response time per operation type
- **Formula:** `sum(response_times_per_operation) / count(responses_per_operation)`
- **Targets:** Same as per-agent targets
- **Alert Thresholds:** 2× target

### 3. Load Distribution Metrics

#### Active Sessions (Per Agent)
- **Definition:** Current number of active sessions per agent
- **Formula:** Count of running sessions
- **Targets:**
  - query-router-1: ≤ 10
  - query-router-2: ≤ 10
  - telegram-manager: ≤ 10
  - web-scraper: ≤ 10
  - file-manager: ≤ 10
  - complex-op-agent-1: ≤ 25
  - complex-op-agent-2: ≤ 25
- **Alert Threshold:** > 90% of max

#### Agent Utilization
- **Definition:** Percentage of agent capacity in use
- **Formula:** `(active_sessions / max_sessions) × 100`
- **Target:** 60-80%
- **Alert Thresholds:** < 40% (underutilized), > 90% (overloaded)

#### Load Balance Index
- **Definition:** Measure of how evenly load is distributed
- **Formula:** `1 - (std_dev(loads) / mean(loads))`
- **Target:** > 0.7
- **Alert Threshold:** < 0.5

#### Queue Length (Per Agent)
- **Definition:** Number of pending requests waiting for agent
- **Formula:** Count of queued requests
- **Target:** < 5
- **Alert Threshold:** > 10

### 4. Error Metrics

#### Error Rate (Per Agent)
- **Definition:** Percentage of requests that resulted in errors
- **Formula:** `(errors / total_requests) × 100`
- **Target:** < 1%
- **Alert Threshold:** > 5%

#### Error Type Distribution
- **Definition:** Count of errors by type
- **Error Types:**
  - Agent not available
  - Timeout
  - Delegation failure
  - Tool execution error
  - Model error
- **Target:** No single error type > 50% of errors
- **Alert Threshold:** Any error type > 70% of errors

#### Error by Agent
- **Definition:** Distribution of errors by agent
- **Formula:** Count per agent / total errors
- **Target:** Balanced distribution
- **Alert Threshold:** Single agent > 40% of errors (if multiple available)

#### Timeout Rate
- **Definition:** Percentage of requests that timed out
- **Formula:** `(timeouts / total_requests) × 100`
- **Target:** < 0.1%
- **Alert Threshold:** > 1%

### 5. Resource Metrics

#### RAM Usage (Per Agent)
- **Definition:** Memory consumed by each agent
- **Formula:** Memory usage in GB
- **Targets:**
  - query-router-1/2: ~6.6 GB each
  - telegram-manager: ~3.3 GB
  - web-scraper: ~3.3 GB
  - file-manager: ~3.3 GB
  - complex-op-agent-1/2: 0 GB (cloud)
- **Alert Threshold:** > 1.2× expected

#### CPU Usage (Per Agent)
- **Definition:** CPU percentage consumed by each agent
- **Formula:** CPU percentage
- **Target:** < 50% per agent
- **Alert Threshold:** > 80%

#### Context Window Usage (Per Agent)
- **Definition:** Percentage of context window used
- **Formula:** `(tokens_used / max_tokens) × 100`
- **Target:** < 80%
- **Alert Threshold:** > 90%

#### Browser Tab Usage (Web Scraper)
- **Definition:** Number of active browser tabs
- **Formula:** Count of open tabs
- **Target:** ≤ 3
- **Alert Threshold:** > 3 (at capacity)

### 6. Quality Metrics

#### Response Accuracy
- **Definition:** Percentage of responses that are accurate and helpful
- **Formula:** `(accurate_responses / total_responses) × 100`
- **Target:** > 90%
- **Alert Threshold:** < 85%

#### Response Completeness
- **Definition:** Percentage of responses that fully address the request
- **Formula:** `(complete_responses / total_responses) × 100`
- **Target:** > 85%
- **Alert Threshold:** < 80%

#### User Satisfaction
- **Definition:** User rating of response quality (1-5 scale)
- **Formula:** Average rating
- **Target:** > 4.0
- **Alert Threshold:** < 3.5

---

## Metrics Collection

### Data Points to Collect

For each request/delegation:

```json
{
  "timestamp": "2026-03-27T22:04:00Z",
  "request_id": "uuid",
  "original_session": "agent:main:telegram:direct:2122311885",
  "delegated_to": "agent:query-router-1:main",
  "operation": "simple_query",
  "complexity": "simple",
  "content_length": 50,
  "delegation_time": "2026-03-27T22:04:01Z",
  "response_time": "2026-03-27T22:04:02Z",
  "processing_time_ms": 1000,
  "status": "success",
  "error": null,
  "agent_load_at_request": 3,
  "agent_max_sessions": 10,
  "context_window_usage": 60,
  "ram_usage_gb": 6.6,
  "cpu_usage_percent": 25
}
```

### Collection Frequency

- **Real-time:** Request-level metrics (every request)
- **Per-minute:** Load distribution, resource usage
- **Per-hour:** Error rates, timeout rates
- **Per-day:** Daily averages, trends

---

## Metrics Storage

### File Structure

```
workspace/
├── metrics/
│   ├── delegation_metrics.json
│   ├── response_time_metrics.json
│   ├── load_distribution_metrics.json
│   ├── error_metrics.json
│   ├── resource_metrics.json
│   ├── quality_metrics.json
│   └── metrics_summary.json
```

### Metrics Format

#### delegation_metrics.json
```json
{
  "total_delegations": 1000,
  "successful_delegations": 970,
  "failed_delegations": 30,
  "success_rate": 0.97,
  "failure_rate": 0.03,
  "by_agent": {
    "query-router-1": 250,
    "query-router-2": 245,
    "web-scraper": 200,
    "telegram-manager": 150,
    "file-manager": 100,
    "complex-op-agent-1": 30,
    "complex-op-agent-2": 25
  },
  "by_operation": {
    "simple_query": 495,
    "web_scrape": 200,
    "telegram_management": 150,
    "file_operation": 100,
    "complex_reasoning": 55
  }
}
```

#### response_time_metrics.json
```json
{
  "average_response_time_ms": 1500,
  "by_agent": {
    "query-router-1": {
      "average_ms": 800,
      "p50_ms": 750,
      "p95_ms": 1200,
      "p99_ms": 2000
    },
    "web-scraper": {
      "average_ms": 2000,
      "p50_ms": 1500,
      "p95_ms": 4000,
      "p99_ms": 6000
    }
  },
  "by_operation": {
    "simple_query": {
      "average_ms": 800
    },
    "x_profile_scan": {
      "average_ms": 2500
    }
  }
}
```

#### load_distribution_metrics.json
```json
{
  "total_sessions": 70,
  "by_agent": {
    "query-router-1": {
      "active": 8,
      "max": 10,
      "utilization": 0.8
    },
    "web-scraper": {
      "active": 6,
      "max": 10,
      "utilization": 0.6
    }
  },
  "load_balance_index": 0.75,
  "queue_lengths": {
    "query-router-1": 2,
    "query-router-2": 1,
    "web-scraper": 0
  }
}
```

---

## Monitoring Scripts

### Metrics Collector Script

Create `/workspace/scripts/collect_metrics.js`:

```javascript
#!/usr/bin/env node

/**
 * Metrics Collector Script
 * Collects performance metrics from agent sessions
 */

const fs = require('fs');
const path = require('path');

const METRICS_DIR = '/Users/efinney/.openclaw/workspace/metrics';

function ensureMetricsDir() {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }
}

function loadMetrics(filename) {
  const filePath = path.join(METRICS_DIR, filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return createEmptyMetrics(filename);
}

function saveMetrics(filename, metrics) {
  const filePath = path.join(METRICS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
}

function createEmptyMetrics(filename) {
  const emptyMetrics = {
    delegation_metrics: {
      total_delegations: 0,
      successful_delegations: 0,
      failed_delegations: 0,
      success_rate: 0,
      failure_rate: 0,
      by_agent: {},
      by_operation: {}
    },
    response_time_metrics: {
      average_response_time_ms: 0,
      by_agent: {},
      by_operation: {}
    },
    load_distribution_metrics: {
      total_sessions: 0,
      by_agent: {},
      load_balance_index: 0,
      queue_lengths: {}
    },
    error_metrics: {
      total_errors: 0,
      error_rate: 0,
      by_type: {},
      by_agent: {}
    },
    resource_metrics: {
      total_ram_gb: 0,
      by_agent: {}
    }
  };
  return emptyMetrics[filename.replace('.json', '')] || {};
}

function collectMetrics() {
  ensureMetricsDir();

  // Load current metrics
  const delegationMetrics = loadMetrics('delegation_metrics.json');
  const responseTimeMetrics = loadMetrics('response_time_metrics.json');
  const loadMetrics_data = loadMetrics('load_distribution_metrics.json');
  const errorMetrics = loadMetrics('error_metrics.json');
  const resourceMetrics = loadMetrics('resource_metrics.json');

  // Collect new metrics (TODO: Integrate with actual agent sessions)
  // For now, just ensure files exist

  // Save metrics
  saveMetrics('delegation_metrics.json', delegationMetrics);
  saveMetrics('response_time_metrics.json', responseTimeMetrics);
  saveMetrics('load_distribution_metrics.json', loadMetrics_data);
  saveMetrics('error_metrics.json', errorMetrics);
  saveMetrics('resource_metrics.json', resourceMetrics);

  // Generate summary
  generateSummary(delegationMetrics, responseTimeMetrics, loadMetrics_data, errorMetrics, resourceMetrics);
}

function generateSummary(delegation, responseTime, load, error, resource) {
  const summary = {
    timestamp: new Date().toISOString(),
    kpi: {
      uptime: "TBD",
      delegation_success_rate: delegation.success_rate || 0,
      avg_response_time_ms: responseTime.average_response_time_ms || 0,
      total_sessions: load.total_sessions || 0,
      error_rate: error.error_rate || 0
    },
    alerts: [],
    status: "ok"
  };

  // Check for alerts
  if (delegation.success_rate < 0.9) {
    summary.alerts.push({
      type: "delegation",
      severity: "warning",
      message: `Delegation success rate below 90%: ${delegation.success_rate * 100}%`
    });
    summary.status = "warning";
  }

  if (responseTime.average_response_time_ms > 5000) {
    summary.alerts.push({
      type: "performance",
      severity: "warning",
      message: `Average response time above 5s: ${responseTime.average_response_time_ms}ms`
    });
    summary.status = "warning";
  }

  if (error.error_rate > 0.05) {
    summary.alerts.push({
      type: "error",
      severity: "critical",
      message: `Error rate above 5%: ${error.error_rate * 100}%`
    });
    summary.status = "critical";
  }

  saveMetrics('metrics_summary.json', summary);
}

// Run collection
collectMetrics();
```

---

## Metrics Dashboard

### Metrics Summary Display

```json
{
  "timestamp": "2026-03-27T22:04:00Z",
  "status": "ok",
  "kpi": {
    "uptime": "99.9%",
    "delegation_success_rate": "97%",
    "avg_response_time_ms": 1500,
    "total_sessions": 70,
    "error_rate": "0.3%"
  },
  "alerts": [],
  "performance_by_agent": {
    "query-router-1": {
      "response_time_ms": 800,
      "utilization": 0.8,
      "error_rate": 0.001
    },
    "web-scraper": {
      "response_time_ms": 2000,
      "utilization": 0.6,
      "error_rate": 0.002
    }
  }
}
```

---

## Alerting

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Delegation success rate | < 90% | < 80% |
| Average response time | > 2× target | > 3× target |
| Error rate | > 1% | > 5% |
| Timeout rate | > 0.5% | > 1% |
| Agent utilization | < 40% or > 90% | < 20% or > 95% |
| RAM usage | > 1.1× expected | > 1.2× expected |
| CPU usage | > 70% | > 90% |
| Context window | > 85% | > 95% |

### Alert Actions

**Warning:**
- Log alert
- Send notification (optional)
- Continue monitoring

**Critical:**
- Log alert
- Send immediate notification
- Consider load shedding (redirect to backup agent)
- Investigate root cause

---

## Performance Optimization

### Optimization Strategies

#### 1. Load Balancing
- Monitor agent utilization
- Redirect load from overloaded agents
- Adjust routing weights dynamically

#### 2. Response Time Optimization
- Identify slow agents
- Optimize agent system prompts
- Reduce context window usage
- Cache common responses

#### 3. Error Reduction
- Identify frequent error types
- Improve error handling
- Add fallback mechanisms
- Increase timeout for slow operations

#### 4. Resource Optimization
- Monitor RAM/CPU usage
- Scale agents based on load
- Optimize browser tab usage
- Clean up idle sessions

---

## Reporting

### Daily Report

Generate daily summary at midnight:

```json
{
  "date": "2026-03-27",
  "summary": {
    "total_requests": 1000,
    "successful_delegations": 970,
    "failed_delegations": 30,
    "avg_response_time_ms": 1500,
    "error_rate": 0.003,
    "uptime": 0.999
  },
  "by_agent": {
    "query-router-1": {
      "requests": 250,
      "avg_time_ms": 800,
      "success_rate": 0.98
    }
  },
  "trends": {
    "response_time_trend": "stable",
    "error_rate_trend": "decreasing",
    "utilization_trend": "increasing"
  }
}
```

### Weekly Report

Generate weekly summary with trends and recommendations.

---

## Implementation Status

### Complete
✅ Metrics defined
✅ Targets set
✅ Alert thresholds defined
✅ Storage format specified
✅ Script structure created

### In Progress
⏳ Metrics collector script (needs integration with agent sessions)
⏳ Real-time metrics collection
⏳ Alerting system
⏳ Dashboard generation

### Next Steps
1. Integrate metrics collection with agent sessions
2. Implement real-time metrics tracking
3. Set up alerting and notifications
4. Create metrics dashboard
5. Automate daily/weekly reports

---

**Created:** 2026-03-27 22:04 EDT
**Status:** Metrics framework complete, integration pending
**Next Required:** Integrate metrics collection with agent sessions