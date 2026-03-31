#!/usr/bin/env node

/**
 * Metrics Collector Script
 * Collects performance metrics from agent sessions
 */

const fs = require('fs');
const path = require('path');

const METRICS_DIR = '/Users/efinney/.openclaw/workspace/metrics';
const MEMORY_DIR = '/Users/efinney/.openclaw/workspace/memory';

function ensureMetricsDir() {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }
}

function loadMetrics(filename) {
  const filePath = path.join(METRICS_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Error loading ${filename}:`, error.message);
      return createEmptyMetrics(filename);
    }
  }
  return createEmptyMetrics(filename);
}

function saveMetrics(filename, metrics) {
  const filePath = path.join(METRICS_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
    console.log(`✓ Saved ${filename}`);
  } catch (error) {
    console.error(`Error saving ${filename}:`, error.message);
  }
}

function createEmptyMetrics(type) {
  const emptyMetrics = {
    delegation_metrics: {
      total_delegations: 0,
      successful_delegations: 0,
      failed_delegations: 0,
      success_rate: 0,
      failure_rate: 0,
      by_agent: {
        'query-router-1': 0,
        'query-router-2': 0,
        'telegram-manager': 0,
        'web-scraper': 0,
        'file-manager': 0,
        'complex-op-agent-1': 0,
        'complex-op-agent-2': 0
      },
      by_operation: {
        'simple_query': 0,
        'x_profile_scan': 0,
        'telegram_channel_scan': 0,
        'web_search': 0,
        'web_scrape': 0,
        'telegram_management': 0,
        'file_operation': 0,
        'complex_reasoning': 0
      }
    },
    response_time_metrics: {
      average_response_time_ms: 0,
      total_response_time_ms: 0,
      response_count: 0,
      by_agent: {
        'query-router-1': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 },
        'query-router-2': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 },
        'telegram-manager': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 },
        'web-scraper': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 },
        'file-manager': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 },
        'complex-op-agent-1': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 },
        'complex-op-agent-2': { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 }
      },
      by_operation: {
        'simple_query': { count: 0, total_ms: 0, avg_ms: 0 },
        'x_profile_scan': { count: 0, total_ms: 0, avg_ms: 0 },
        'telegram_channel_scan': { count: 0, total_ms: 0, avg_ms: 0 },
        'web_search': { count: 0, total_ms: 0, avg_ms: 0 },
        'web_scrape': { count: 0, total_ms: 0, avg_ms: 0 },
        'telegram_management': { count: 0, total_ms: 0, avg_ms: 0 },
        'file_operation': { count: 0, total_ms: 0, avg_ms: 0 },
        'complex_reasoning': { count: 0, total_ms: 0, avg_ms: 0 }
      }
    },
    load_distribution_metrics: {
      total_sessions: 0,
      by_agent: {
        'query-router-1': { active: 0, max: 10, utilization: 0 },
        'query-router-2': { active: 0, max: 10, utilization: 0 },
        'telegram-manager': { active: 0, max: 10, utilization: 0 },
        'web-scraper': { active: 0, max: 10, utilization: 0 },
        'file-manager': { active: 0, max: 10, utilization: 0 },
        'complex-op-agent-1': { active: 0, max: 25, utilization: 0 },
        'complex-op-agent-2': { active: 0, max: 25, utilization: 0 }
      },
      load_balance_index: 0,
      queue_lengths: {
        'query-router-1': 0,
        'query-router-2': 0,
        'telegram-manager': 0,
        'web-scraper': 0,
        'file-manager': 0,
        'complex-op-agent-1': 0,
        'complex-op-agent-2': 0
      }
    },
    error_metrics: {
      total_errors: 0,
      total_requests: 0,
      error_rate: 0,
      by_type: {
        'agent_not_available': 0,
        'timeout': 0,
        'delegation_failure': 0,
        'tool_error': 0,
        'model_error': 0,
        'other': 0
      },
      by_agent: {
        'query-router-1': 0,
        'query-router-2': 0,
        'telegram-manager': 0,
        'web-scraper': 0,
        'file-manager': 0,
        'complex-op-agent-1': 0,
        'complex-op-agent-2': 0
      }
    },
    resource_metrics: {
      total_ram_gb: 0,
      total_cpu_percent: 0,
      by_agent: {
        'query-router-1': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0 },
        'query-router-2': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0 },
        'telegram-manager': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0 },
        'web-scraper': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0, browser_tabs: 0 },
        'file-manager': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0 },
        'complex-op-agent-1': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0 },
        'complex-op-agent-2': { ram_gb: 0, cpu_percent: 0, context_window_usage: 0 }
      }
    }
  };
  return emptyMetrics[type.replace('.json', '')] || {};
}

function recordDelegation(agent, operation, success) {
  const metrics = loadMetrics('delegation_metrics.json');
  
  metrics.total_delegations++;
  if (success) {
    metrics.successful_delegations++;
  } else {
    metrics.failed_delegations++;
  }
  
  metrics.by_agent[agent] = (metrics.by_agent[agent] || 0) + 1;
  metrics.by_operation[operation] = (metrics.by_operation[operation] || 0) + 1;
  
  metrics.success_rate = metrics.successful_delegations / metrics.total_delegations;
  metrics.failure_rate = metrics.failed_delegations / metrics.total_delegations;
  
  saveMetrics('delegation_metrics.json', metrics);
}

function recordResponseTime(agent, operation, responseTimeMs) {
  const metrics = loadMetrics('response_time_metrics.json');
  
  metrics.total_response_time_ms += responseTimeMs;
  metrics.response_count++;
  metrics.average_response_time_ms = metrics.total_response_time_ms / metrics.response_count;
  
  // Update by_agent
  if (!metrics.by_agent[agent]) {
    metrics.by_agent[agent] = { count: 0, total_ms: 0, avg_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0 };
  }
  metrics.by_agent[agent].count++;
  metrics.by_agent[agent].total_ms += responseTimeMs;
  metrics.by_agent[agent].avg_ms = metrics.by_agent[agent].total_ms / metrics.by_agent[agent].count;
  
  // Update by_operation
  if (!metrics.by_operation[operation]) {
    metrics.by_operation[operation] = { count: 0, total_ms: 0, avg_ms: 0 };
  }
  metrics.by_operation[operation].count++;
  metrics.by_operation[operation].total_ms += responseTimeMs;
  metrics.by_operation[operation].avg_ms = metrics.by_operation[operation].total_ms / metrics.by_operation[operation].count;
  
  saveMetrics('response_time_metrics.json', metrics);
}

function recordLoad(agent, activeSessions) {
  const metrics = loadMetrics('load_distribution_metrics.json');
  
  const maxSessions = {
    'query-router-1': 10,
    'query-router-2': 10,
    'telegram-manager': 10,
    'web-scraper': 10,
    'file-manager': 10,
    'complex-op-agent-1': 25,
    'complex-op-agent-2': 25
  };
  
  metrics.by_agent[agent].active = activeSessions;
  metrics.by_agent[agent].max = maxSessions[agent];
  metrics.by_agent[agent].utilization = activeSessions / maxSessions[agent];
  
  metrics.total_sessions = Object.values(metrics.by_agent).reduce((sum, agent) => sum + agent.active, 0);
  
  // Calculate load balance index (1 - std_dev / mean)
  const utilizations = Object.values(metrics.by_agent).map(a => a.utilization);
  const mean = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
  const variance = utilizations.reduce((sum, u) => sum + Math.pow(u - mean, 2), 0) / utilizations.length;
  const stdDev = Math.sqrt(variance);
  metrics.load_balance_index = mean > 0 ? (1 - stdDev / mean) : 0;
  
  saveMetrics('load_distribution_metrics.json', metrics);
}

function recordError(agent, errorType) {
  const metrics = loadMetrics('error_metrics.json');
  
  metrics.total_errors++;
  metrics.total_requests++;
  metrics.error_rate = metrics.total_errors / metrics.total_requests;
  
  metrics.by_type[errorType] = (metrics.by_type[errorType] || 0) + 1;
  metrics.by_agent[agent] = (metrics.by_agent[agent] || 0) + 1;
  
  saveMetrics('error_metrics.json', metrics);
}

function recordResourceUsage(agent, ramGb, cpuPercent, contextWindowUsage, browserTabs = 0) {
  const metrics = loadMetrics('resource_metrics.json');
  
  if (!metrics.by_agent[agent]) {
    metrics.by_agent[agent] = { ram_gb: 0, cpu_percent: 0, context_window_usage: 0, browser_tabs: 0 };
  }
  
  metrics.by_agent[agent].ram_gb = ramGb;
  metrics.by_agent[agent].cpu_percent = cpuPercent;
  metrics.by_agent[agent].context_window_usage = contextWindowUsage;
  metrics.by_agent[agent].browser_tabs = browserTabs;
  
  metrics.total_ram_gb = Object.values(metrics.by_agent).reduce((sum, a) => sum + a.ram_gb, 0);
  metrics.total_cpu_percent = Object.values(metrics.by_agent).reduce((sum, a) => sum + a.cpu_percent, 0) / Object.keys(metrics.by_agent).length;
  
  saveMetrics('resource_metrics.json', metrics);
}

function generateSummary() {
  const delegation = loadMetrics('delegation_metrics.json');
  const responseTime = loadMetrics('response_time_metrics.json');
  const load = loadMetrics('load_distribution_metrics.json');
  const error = loadMetrics('error_metrics.json');
  const resource = loadMetrics('resource_metrics.json');
  
  const summary = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    kpi: {
      total_delegations: delegation.total_delegations,
      delegation_success_rate: delegation.success_rate,
      avg_response_time_ms: responseTime.average_response_time_ms,
      total_sessions: load.total_sessions,
      error_rate: error.error_rate,
      load_balance_index: load.load_balance_index,
      total_ram_gb: resource.total_ram_gb,
      total_cpu_percent: resource.total_cpu_percent
    },
    alerts: [],
    performance_by_agent: {}
  };
  
  // Add performance by agent
  Object.keys(delegation.by_agent).forEach(agent => {
    summary.performance_by_agent[agent] = {
      delegations: delegation.by_agent[agent],
      avg_response_time_ms: responseTime.by_agent[agent]?.avg_ms || 0,
      utilization: load.by_agent[agent]?.utilization || 0,
      error_count: error.by_agent[agent] || 0,
      ram_gb: resource.by_agent[agent]?.ram_gb || 0,
      cpu_percent: resource.by_agent[agent]?.cpu_percent || 0
    };
  });
  
  // Check for alerts
  if (delegation.success_rate < 0.9) {
    summary.alerts.push({
      type: 'delegation',
      severity: delegation.success_rate < 0.8 ? 'critical' : 'warning',
      message: `Delegation success rate: ${(delegation.success_rate * 100).toFixed(1)}%`
    });
    if (delegation.success_rate < 0.8) summary.status = 'critical';
    else if (summary.status === 'ok') summary.status = 'warning';
  }
  
  if (responseTime.average_response_time_ms > 5000) {
    summary.alerts.push({
      type: 'performance',
      severity: responseTime.average_response_time_ms > 10000 ? 'critical' : 'warning',
      message: `Average response time: ${responseTime.average_response_time_ms.toFixed(0)}ms`
    });
    if (responseTime.average_response_time_ms > 10000) summary.status = 'critical';
    else if (summary.status === 'ok') summary.status = 'warning';
  }
  
  if (error.error_rate > 0.05) {
    summary.alerts.push({
      type: 'error',
      severity: 'critical',
      message: `Error rate: ${(error.error_rate * 100).toFixed(2)}%`
    });
    summary.status = 'critical';
  }
  
  if (load.load_balance_index < 0.5) {
    summary.alerts.push({
      type: 'load_balance',
      severity: 'warning',
      message: `Load balance index: ${load.load_balance_index.toFixed(2)}`
    });
    if (summary.status === 'ok') summary.status = 'warning';
  }
  
  if (resource.total_ram_gb > 35) {
    summary.alerts.push({
      type: 'resource',
      severity: resource.total_ram_gb > 38 ? 'critical' : 'warning',
      message: `Total RAM usage: ${resource.total_ram_gb.toFixed(1)}GB`
    });
    if (resource.total_ram_gb > 38) summary.status = 'critical';
    else if (summary.status === 'ok') summary.status = 'warning';
  }
  
  saveMetrics('metrics_summary.json', summary);
  
  return summary;
}

function collectMetrics() {
  ensureMetricsDir();
  
  console.log('Collecting performance metrics...');
  
  // Load current metrics
  const delegation = loadMetrics('delegation_metrics.json');
  const responseTime = loadMetrics('response_time_metrics.json');
  const load = loadMetrics('load_distribution_metrics.json');
  const error = loadMetrics('error_metrics.json');
  const resource = loadMetrics('resource_metrics.json');
  
  // TODO: Integrate with actual agent sessions
  // For now, just ensure files exist with empty metrics
  
  // Save empty metrics
  saveMetrics('delegation_metrics.json', delegation);
  saveMetrics('response_time_metrics.json', responseTime);
  saveMetrics('load_distribution_metrics.json', load);
  saveMetrics('error_metrics.json', error);
  saveMetrics('resource_metrics.json', resource);
  
  // Generate summary
  const summary = generateSummary();
  
  console.log('✓ Metrics collection complete');
  console.log(`Status: ${summary.status}`);
  console.log(`Total delegations: ${summary.kpi.total_delegations}`);
  console.log(`Success rate: ${(summary.kpi.delegation_success_rate * 100).toFixed(1)}%`);
  console.log(`Avg response time: ${summary.kpi.avg_response_time_ms.toFixed(0)}ms`);
  console.log(`Total sessions: ${summary.kpi.total_sessions}`);
  console.log(`Error rate: ${(summary.kpi.error_rate * 100).toFixed(2)}%`);
  
  if (summary.alerts.length > 0) {
    console.log(`\n⚠️  Alerts: ${summary.alerts.length}`);
    summary.alerts.forEach(alert => {
      console.log(`  [${alert.severity.toUpperCase()}] ${alert.message}`);
    });
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'collect':
    collectMetrics();
    break;
  
  case 'record-delegation':
    const agent = process.argv[3];
    const operation = process.argv[4];
    const success = process.argv[5] === 'true';
    recordDelegation(agent, operation, success);
    console.log(`✓ Recorded delegation to ${agent} (${operation}): ${success ? 'success' : 'failed'}`);
    break;
  
  case 'record-response':
    const agent2 = process.argv[3];
    const operation2 = process.argv[4];
    const responseTime = parseInt(process.argv[5]);
    recordResponseTime(agent2, operation2, responseTime);
    console.log(`✓ Recorded response time for ${agent2}: ${responseTime}ms`);
    break;
  
  case 'record-load':
    const agent3 = process.argv[3];
    const activeSessions = parseInt(process.argv[4]);
    recordLoad(agent3, activeSessions);
    console.log(`✓ Recorded load for ${agent3}: ${activeSessions} sessions`);
    break;
  
  case 'record-error':
    const agent4 = process.argv[3];
    const errorType = process.argv[4];
    recordError(agent4, errorType);
    console.log(`✓ Recorded error for ${agent4}: ${errorType}`);
    break;
  
  case 'record-resource':
    const agent5 = process.argv[3];
    const ram = parseFloat(process.argv[4]);
    const cpu = parseFloat(process.argv[5]);
    const context = parseFloat(process.argv[6]);
    const tabs = parseInt(process.argv[7]) || 0;
    recordResourceUsage(agent5, ram, cpu, context, tabs);
    console.log(`✓ Recorded resource usage for ${agent5}: ${ram}GB RAM, ${cpu}% CPU`);
    break;
  
  case 'summary':
    const summary = generateSummary();
    console.log(JSON.stringify(summary, null, 2));
    break;
  
  default:
    console.log('Usage: node collect_metrics.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  collect                    - Collect and save metrics');
    console.log('  record-delegation <agent> <operation> <success>');
    console.log('  record-response <agent> <operation> <time_ms>');
    console.log('  record-load <agent> <active_sessions>');
    console.log('  record-error <agent> <error_type>');
    console.log('  record-resource <agent> <ram_gb> <cpu_percent> <context_usage> [browser_tabs]');
    console.log('  summary                    - Generate and display summary');
    console.log('');
    console.log('Examples:');
    console.log('  node collect_metrics.js collect');
    console.log('  node collect_metrics.js record-delegation query-router-1 simple_query true');
    console.log('  node collect_metrics.js record-response query-router-1 simple_query 800');
    console.log('  node collect_metrics.js record-load query-router-1 5');
    console.log('  node collect_metrics.js record-error query-router-1 timeout');
    console.log('  node collect_metrics.js record-resource query-router-1 6.6 25 60');
    console.log('  node collect_metrics.js record-resource web-scraper 3.3 30 70 2');
    process.exit(1);
}

// Export functions for programmatic use
module.exports = {
  recordDelegation,
  recordResponseTime,
  recordLoad,
  recordError,
  recordResourceUsage,
  generateSummary,
  collectMetrics
};