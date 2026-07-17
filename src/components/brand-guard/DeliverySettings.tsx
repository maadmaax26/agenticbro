import { useCallback, useEffect, useState } from 'react';

interface DeliveryEndpoint {
  id: string;
  name: string;
  channel: 'slack' | 'webhook';
  enabled: boolean;
  event_types: string[];
  minimum_severity: string;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
}

export function DeliverySettings({ authToken, brandMonitorId }: { authToken: string; brandMonitorId: string }) {
  const [endpoints, setEndpoints] = useState<DeliveryEndpoint[]>([]);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [name, setName] = useState('Security alerts');
  const [channel, setChannel] = useState<'slack' | 'webhook'>('slack');
  const [url, setUrl] = useState('');
  const [minimumSeverity, setMinimumSeverity] = useState('medium');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${authToken}` };
  const load = useCallback(async () => {
    const [endpointResponse, monitoringResponse] = await Promise.all([
      fetch('/api/brand-guard/delivery', { headers }),
      fetch('/api/brand-guard/delivery/monitoring', { headers }),
    ]);
    const endpointData = await endpointResponse.json();
    const monitoringData = await monitoringResponse.json();
    if (!endpointResponse.ok) throw new Error(endpointData.error || 'Failed to load delivery endpoints');
    setEndpoints(endpointData.endpoints || []);
    if (monitoringResponse.ok) setMonitoring(monitoringData);
  }, [authToken]);

  useEffect(() => { load().catch(err => setError(err instanceof Error ? err.message : 'Failed to load delivery settings')); }, [load]);

  async function createEndpoint() {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/brand-guard/delivery', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, channel, url, brand_monitor_id: brandMonitorId, minimum_severity: minimumSeverity,
          event_types: ['alert', 'weekly_briefing', 'sla_report'],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create endpoint');
      setUrl('');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create endpoint'); }
    finally { setSaving(false); }
  }

  async function endpointAction(id: string, action: 'test' | 'delete') {
    const response = await fetch(action === 'test' ? '/api/brand-guard/delivery/test' : `/api/brand-guard/delivery?id=${id}`, {
      method: action === 'test' ? 'POST' : 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' },
      body: action === 'test' ? JSON.stringify({ endpoint_id: id }) : undefined,
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || `Failed to ${action} endpoint`); return; }
    await load();
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ padding: '18px', borderRadius: '12px', background: 'rgba(15,15,25,.8)', border: '1px solid rgba(139,92,246,.25)' }}>
        <div style={{ color: '#fff', fontWeight: 700, marginBottom: '4px' }}>Customer Delivery</div>
        <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '16px' }}>Send signed Brand Guard alerts and enterprise reports to Slack or your security webhook.</div>
        {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', marginBottom: '10px' }}>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Endpoint name" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#fff' }} />
          <select value={channel} onChange={event => setChannel(event.target.value as 'slack' | 'webhook')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#fff' }}>
            <option value="slack">Slack</option><option value="webhook">Webhook</option>
          </select>
        </div>
        <input value={url} onChange={event => setUrl(event.target.value)} placeholder={channel === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://security.example.com/hooks/brand-guard'} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#fff', marginBottom: '10px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <select value={minimumSeverity} onChange={event => setMinimumSeverity(event.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#fff' }}>
            {['info', 'low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value.toUpperCase()}+</option>)}
          </select>
          <button onClick={createEndpoint} disabled={saving || !url || !name} style={{ padding: '10px 18px', borderRadius: '8px', border: 0, background: '#8b5cf6', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}>{saving ? 'Saving...' : 'Add Endpoint'}</button>
        </div>
      </div>

      {monitoring && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[['Queued', monitoring.summary?.queued || 0], ['Delivered 24h', monitoring.summary?.delivered_24h || 0], ['Dead Letters', monitoring.summary?.dead_letters || 0]].map(([label, value]) => (
            <div key={String(label)} style={{ padding: '14px', textAlign: 'center', borderRadius: '10px', background: 'rgba(15,15,25,.8)', border: '1px solid rgba(139,92,246,.2)' }}><div style={{ color: '#fff', fontSize: '22px', fontWeight: 800 }}>{value}</div><div style={{ color: '#9ca3af', fontSize: '11px' }}>{label}</div></div>
          ))}
        </div>
      )}

      {endpoints.map(endpoint => (
        <div key={endpoint.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '10px', background: 'rgba(15,15,25,.8)', border: `1px solid ${endpoint.consecutive_failures ? 'rgba(239,68,68,.4)' : 'rgba(34,197,94,.25)'}` }}>
          <div><div style={{ color: '#fff', fontWeight: 600 }}>{endpoint.name} <span style={{ color: '#8b5cf6', fontSize: '11px' }}>{endpoint.channel.toUpperCase()}</span></div><div style={{ color: '#9ca3af', fontSize: '11px' }}>{endpoint.minimum_severity.toUpperCase()}+ · {endpoint.consecutive_failures ? `${endpoint.consecutive_failures} consecutive failures` : 'Healthy'}</div></div>
          <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => endpointAction(endpoint.id, 'test')} style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid #4b5563', background: 'transparent', color: '#d1d5db', cursor: 'pointer' }}>Test</button><button onClick={() => endpointAction(endpoint.id, 'delete')} style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid #7f1d1d', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>Remove</button></div>
        </div>
      ))}
    </div>
  );
}
