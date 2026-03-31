#!/usr/bin/env node

/**
 * Memory Logger Helper Script
 * 
 * Helper functions for logging to the memory system across sessions.
 * Usage: node scripts/memory-logger.js <command> <args>
 */

const fs = require('fs');
const path = require('path');

// Memory directory paths
const MEMORY_DIR = '/Users/efinney/.openclaw/workspace/memory';
const AGENT_REGISTRY = path.join(MEMORY_DIR, 'AGENT_REGISTRY.md');
const CONFIG_CHANGES = path.join(MEMORY_DIR, 'CONFIG_CHANGES.md');
const SESSION_EVENTS = path.join(MEMORY_DIR, 'SESSION_EVENTS.md');

// Get current session key from environment or default
const SESSION_KEY = process.env.SESSION_KEY || 'unknown-session';
const TIMESTAMP = new Date().toISOString();

/**
 * Append content to a file
 */
function appendToFile(filePath, content) {
  try {
    fs.appendFileSync(filePath, content + '\n\n');
    console.log(`✓ Appended to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error appending to ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Log agent creation to registry
 */
function logAgentCreation(args) {
  const { name, purpose, model, configPath } = args;
  
  const entry = `### ${name}
- **Created:** ${TIMESTAMP}
- **Created by:** ${SESSION_KEY}
- **Purpose:** ${purpose || 'Not specified'}
- **Model:** ${model || 'Not specified'}
- **Config Path:** ${configPath || 'Not specified'}
- **Status:** Active
`;
  
  console.log(`Logging agent creation: ${name}`);
  return appendToFile(AGENT_REGISTRY, entry);
}

/**
 * Log configuration change
 */
function logConfigChange(args) {
  const { from, to, reason, status } = args;
  
  const entry = `### ${TIMESTAMP} - Model/Config Change
- **From:** ${from || 'Not specified'}
- **To:** ${to || 'Not specified'}
- **Reason:** ${reason || 'Not specified'}
- **Changed by:** ${SESSION_KEY}
- **Status:** ${status || 'Unknown'}
`;
  
  console.log(`Logging config change: ${from} → ${to}`);
  return appendToFile(CONFIG_CHANGES, entry);
}

/**
 * Log session event
 */
function logSessionEvent(args) {
  const { event, eventType, details, status, impact } = args;
  
  const detailsStr = details ? JSON.stringify(details, null, 2) : 'N/A';
  
  const entry = `### ${TIMESTAMP} - ${event}
- **Session:** ${SESSION_KEY}
- **Event:** ${event}
- **Type:** ${eventType || 'General'}
- **Details:** ${detailsStr}
- **Status:** ${status || 'Unknown'}
- **Impact:** ${impact || 'N/A'}
- **Changed by:** ${SESSION_KEY}
`;
  
  console.log(`Logging session event: ${event}`);
  return appendToFile(SESSION_EVENTS, entry);
}

/**
 * Update daily memory log
 */
function updateDailyMemory(args) {
  const { category, content } = args;
  const today = new Date().toISOString().split('T')[0];
  const dailyMemoryPath = path.join(MEMORY_DIR, `${today}.md`);
  
  const entry = `### ${TIMESTAMP} - ${category}
- **Content:** ${content}
- **Session:** ${SESSION_KEY}
`;
  
  console.log(`Updating daily memory: ${category}`);
  return appendToFile(dailyMemoryPath, entry);
}

/**
 * Main command router
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: node scripts/memory-logger.js <command> <args>');
    console.log('');
    console.log('Commands:');
    console.log('  agent-create <name> <purpose> <model> <configPath>');
    console.log('  config-change <from> <to> <reason> <status>');
    console.log('  session-event <event> <eventType> <details> <status> <impact>');
    console.log('  daily-memory <category> <content>');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/memory-logger.js agent-create "new-agent" "Handle scans" "qwen3.5:9b" "~/.openclaw/agents/new-agent/"');
    console.log('  node scripts/memory-logger.js config-change "glm-4.7:cloud" "deepseek-v3.2" "Optimization" "Success"');
    process.exit(1);
  }
  
  let result = false;
  
  switch (command) {
    case 'agent-create':
      result = logAgentCreation({
        name: args[1],
        purpose: args[2],
        model: args[3],
        configPath: args[4]
      });
      break;
    
    case 'config-change':
      result = logConfigChange({
        from: args[1],
        to: args[2],
        reason: args[3],
        status: args[4]
      });
      break;
    
    case 'session-event':
      result = logSessionEvent({
        event: args[1],
        eventType: args[2],
        details: args[3] ? JSON.parse(args[3]) : null,
        status: args[4],
        impact: args[5]
      });
      break;
    
    case 'daily-memory':
      result = updateDailyMemory({
        category: args[1],
        content: args[2]
      });
      break;
    
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
  
  process.exit(result ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  logAgentCreation,
  logConfigChange,
  logSessionEvent,
  updateDailyMemory
};