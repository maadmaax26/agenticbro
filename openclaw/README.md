# AgenticBro OpenClaw — Mac Studio Worker

Replaces the ngrok tunnel with a Supabase-based durable job queue.

## Quick Start

### 1. Install Python dependency
```bash
pip3 install supabase
```

### 2. Set environment variables
```bash
export SUPABASE_URL=https://drvasofyghnxfxvkkwad.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```
Get the service role key from: Supabase Dashboard → Project Settings → API → service_role

### 3. Run the SQL migration
Open `../supabase/migrations/001_scan_jobs_queue.sql` in the Supabase SQL Editor and run it.

### 4. Enable Realtime
Supabase Dashboard → Database → Replication → Add table → select `scan_jobs`

### 5. Start worker manually (dev/test)
```bash
python3 workers/scan_worker.py
```

### 6. Install as launchd service (production)
```bash
# Edit the plist to set your real service role key
nano launchd/com.agenticbro.scan-worker.plist

cp launchd/com.agenticbro.scan-worker.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.agenticbro.scan-worker.plist
launchctl list | grep agenticbro   # confirm running
```

## Monitoring
```bash
tail -f /tmp/agenticbro-scan-worker.log      # stdout
tail -f /tmp/agenticbro-scan-worker.err      # stderr
launchctl list | grep agenticbro             # process status
```

## Key Commands
| Action | Command |
|---|---|
| Stop worker | `launchctl stop com.agenticbro.scan-worker` |
| Start worker | `launchctl start com.agenticbro.scan-worker` |
| Restart worker | `launchctl stop com.agenticbro.scan-worker && launchctl start com.agenticbro.scan-worker` |
| View pending jobs | Supabase → Table Editor → scan_jobs → filter status=pending |
| Clear stuck jobs | Run `SELECT requeue_timed_out_jobs();` in Supabase SQL Editor |
| Test POST endpoint | `curl -X POST https://agenticbro.app/api/scan -H 'Content-Type: application/json' -d '{"address":"TEST_ADDR","scan_type":"token"}'` |
