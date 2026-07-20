/**
 * Background Worker for Agentic Bro
 * 
 * Processes async tasks:
 * - Scammer report reviews
 * - Cache warming
 * - Analytics aggregation
 * - Scheduled cleanups
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Task queue key
const TASK_QUEUE = 'agenticbro:tasks';

interface Task {
  id: string;
  type: 'review_report' | 'warm_cache' | 'aggregate_analytics' | 'cleanup';
  data: any;
  priority: number;
  created_at: Date;
}

/**
 * Main worker loop
 */
async function startWorker() {
  console.log('🚀 Agentic Bro Worker started');
  console.log('📦 Waiting for tasks...');

  while (true) {
    try {
      // Block for new task
      const task = await getNextTask();

      if (task) {
        console.log(`📋 Processing task: ${task.type} (${task.id})`);
        
        const startTime = Date.now();
        
        try {
          await processTask(task);
          const duration = Date.now() - startTime;
          console.log(`✅ Task completed: ${task.type} (${task.id}) in ${duration}ms`);
        } catch (error) {
          console.error(`❌ Task failed: ${task.type} (${task.id})`, error);
          await markTaskFailed(task, error);
        }
      }
    } catch (error) {
      console.error('Worker error:', error);
      // Wait before retrying
      await sleep(5000);
    }
  }
}

/**
 * Get next task from queue
 */
async function getNextTask(): Promise<Task | null> {
  // BRPOPLPUSH: Pop from queue and push to processing
  const result = await redis.brpoplpush(TASK_QUEUE, `${TASK_QUEUE}:processing`, 5);

  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * Process task based on type
 */
async function processTask(task: Task): Promise<void> {
  switch (task.type) {
    case 'review_report':
      await processReportReview(task.data);
      break;

    case 'warm_cache':
      await processCacheWarming(task.data);
      break;

    case 'aggregate_analytics':
      await processAnalyticsAggregation(task.data);
      break;

    case 'cleanup':
      await processCleanup(task.data);
      break;

    default:
      console.warn(`Unknown task type: ${task.type}`);
  }
}

/**
 * Process scammer report review
 */
async function processReportReview(data: { reportId: string }): Promise<void> {
  const { reportId } = data;

  // Get report
  const result = await db.query(
    'SELECT * FROM scammer_reports WHERE id = $1',
    [reportId]
  );

  if (result.rows.length === 0) {
    console.warn(`Report not found: ${reportId}`);
    return;
  }

  const report = result.rows[0];

  // Check if similar reports exist
  const similarReports = await db.query(
    `SELECT COUNT(*) FROM scammer_reports 
     WHERE platform = $1 
     AND LOWER(username) = LOWER($2) 
     AND status = 'confirmed'`,
    [report.platform, report.username]
  );

  // Auto-approve if multiple reports for same username
  if (parseInt(similarReports.rows[0].count) >= 3) {
    // Add to known scammers
    await db.query(
      `INSERT INTO known_scammers (platform, username, display_name, scam_type, impersonating, evidence_urls, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       ON CONFLICT (platform, username) DO UPDATE SET
         victim_count = known_scammers.victim_count + 1,
         last_seen = NOW(),
         status = 'active'`,
      [report.platform, report.username, report.display_name, report.scam_type, report.impersonating, report.evidence_urls]
    );

    // Mark report as confirmed
    await db.query(
      `UPDATE scammer_reports SET status = 'confirmed', reviewed_at = NOW() WHERE id = $1`,
      [reportId]
    );

    // Invalidate cache
    await redis.del(`verify:${report.platform}:${report.username}`);
    
    console.log(`✅ Report ${reportId} auto-approved (multiple reports)`);
  } else {
    // Mark as under review for manual review
    await db.query(
      `UPDATE scammer_reports SET status = 'under_review' WHERE id = $1`,
      [reportId]
    );
  }
}

/**
 * Process cache warming
 */
async function processCacheWarming(data: { keys: string[] }): Promise<void> {
  const { keys } = data;

  for (const key of keys) {
    // Warm popular tokens/profiles cache
    if (key.startsWith('scan:')) {
      // Would trigger a fresh scan
      console.log(`Warming cache for token: ${key}`);
    } else if (key.startsWith('verify:')) {
      // Would trigger a fresh verification
      console.log(`Warming cache for profile: ${key}`);
    }
  }
}

/**
 * Process analytics aggregation
 */
async function processAnalyticsAggregation(data: { date: string }): Promise<void> {
  const { date } = data;

  // Aggregate daily stats
  await db.query(`
    INSERT INTO daily_stats (date, total_scans, total_verifications, new_users, reports_submitted, avg_token_risk, avg_profile_score)
    SELECT 
      $1::date,
      (SELECT COUNT(*) FROM token_scan_history WHERE DATE(scan_time) = $1::date),
      (SELECT COUNT(*) FROM profile_verification_history WHERE DATE(scan_time) = $1::date),
      (SELECT COUNT(*) FROM users WHERE DATE(created_at) = $1::date),
      (SELECT COUNT(*) FROM scammer_reports WHERE DATE(created_at) = $1::date),
      (SELECT AVG(risk_score) FROM token_scan_history WHERE DATE(scan_time) = $1::date),
      (SELECT AVG(authenticity_score) FROM profile_verification_history WHERE DATE(scan_time) = $1::date)
    ON CONFLICT (date) DO UPDATE SET
      total_scans = EXCLUDED.total_scans,
      total_verifications = EXCLUDED.total_verifications,
      new_users = EXCLUDED.new_users,
      reports_submitted = EXCLUDED.reports_submitted,
      avg_token_risk = EXCLUDED.avg_token_risk,
      avg_profile_score = EXCLUDED.avg_profile_score
  `, [date]);

  console.log(`📊 Aggregated analytics for ${date}`);
}

/**
 * Process cleanup tasks
 */
async function processCleanup(data: { type: string }): Promise<void> {
  const { type } = data;

  switch (type) {
    case 'expired_sessions':
      await db.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
      break;

    case 'old_api_usage':
      await db.query('DELETE FROM api_usage WHERE created_at < NOW() - INTERVAL \'90 days\'');
      break;

    case 'cache_cleanup':
      // Clean up old cache entries
      const keys = await redis.keys('agenticbro:*');
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -1) {
          // No TTL set, set default
          await redis.expire(key, 3600);
        }
      }
      break;

    default:
      console.warn(`Unknown cleanup type: ${type}`);
  }
}

/**
 * Mark task as failed
 */
async function markTaskFailed(task: Task, error: any): Promise<void> {
  // Move to failed queue
  await redis.lpush(`${TASK_QUEUE}:failed`, JSON.stringify({
    ...task,
    error: error.message,
    failed_at: new Date().toISOString(),
  }));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('Shutting down worker...');
  
  await db.end();
  await redis.quit();
  
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start worker
startWorker();