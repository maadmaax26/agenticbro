/**
 * Debug endpoint to check what environment vars are loaded
 */
import express, { Request, Response } from 'express';

const router = express();

router.get('/debug/env', (_req: Request, res: Response): void => {
  const envVars = {
    'TELEGRAM_API_ID': process.env.TELEGRAM_API_ID || 'NOT_SET',
    'TELEGRAM_API_HASH': process.env.TELEGRAM_API_HASH || 'NOT_SET',
    'TELEGRAM_SESSION_STRING': process.env.TEGRAM_SESSION_STRING ? 'SET' + process.env.TEGRAM_SESSION_SECURITY_STRING.slice(0, 20) + '...' : 'NOT_SET',
    'SERVER_PORT': process.env.SERVER_PORT || 'NOT_SET',
    'NODE_ENV': process.env.NODE_ENV || 'NOT_SET',
  };

  res.json({
    status: 'ok',
    env: envVars,
    hasTelegram: !!(
      envVars['TELEGRAM_API_ID'] !== 'NOT_SET' &&
      envVars['TELEGRAM_API_HASH'] !== 'NOT_SET' &&
      envVars['TELEGRAM_SESSION_STRING'] !== 'NOT_SET'
    ),
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    ts: Date.now(),
  });
});

export default router;