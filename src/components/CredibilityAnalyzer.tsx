/**
 * Credibility Analyzer Component
 *
 * Analyzes X/Twitter and Telegram users for history of lying, deception,
 * paid promotion fraud, ghost accounts, and credibility scoring.
 *
 * Uses /api/credibility-scan endpoint (Supabase queue → Mac Studio worker)
 */
import { useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ClaimResult {
    type: string;
    description: string;
    weight: number;
    excerpt: string;
    date: string;
    postUrl: string;
    verificationStatus: 'verified' | 'unverified' | 'contradicted' | 'false';
    evidence?: string;
}

interface DeceptionSignalResult {
    signal: string;
    description: string;
    weight: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    evidence: any;
}

interface CredibilityScanResult {
    success: boolean;
    status?: string;
    message?: string;
    jobId?: string;
    platform: string;
    username: string;
    displayName?: string;
    profileData?: {
        name?: string;
        bio?: string;
        followers?: string;
        following?: string;
        joined?: string;
        postCount?: string;
    };
    postsAnalyzed: number;
    claims: ClaimResult[];
    deceptionSignals: DeceptionSignalResult[];
    score: {
        credibilityScore: number;
        lieScore: number;
        level: string;
        breakdown: {
            totalClaims: number;
            verified: number;
            contradicted: number;
            false: number;
            unverified: number;
            deceptionSignals: number;
            signalPenalty: number;
        };
    };
    scanDate: string;
    dataSource: string;
    disclaimer: string;
}

// ─── Severity colors ────────────────────────────────────────────────────────────
const severityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

const statusEmoji: Record<string, string> = {
    verified: '✅',
    unverified: '⚠️',
    contradicted: '❌',
    false: '🚫',
};

// ─── Component ──────────────────────────────────────────────────────────────────
export function CredibilityAnalyzer() {
    const [platform, setPlatform] = useState<'twitter' | 'telegram'>('twitter');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<CredibilityScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleScan = useCallback(async () => {
        if (!username.trim()) {
            setError('Enter a username');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/credibility-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform,
                    username: username.trim().replace(/^@/, ''),
                    limit: 50,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Scan failed');
                return;
            }

            if (data.status === 'pending') {
                setError('Scan queued — results will be available in a moment. Please refresh.');
                return;
            }

            setResult(data);
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [platform, username]);

    // ─── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="w-full p-3 sm:p-4">
            {/* Input */}
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-gray-400 mb-3">
                    Detects lying, deception, paid promotion fraud & ghost accounts on X & Telegram
                </p>
                <div className="flex gap-2 mb-3">
                    <select
                        value={platform}
                        onChange={e => setPlatform(e.target.value as 'twitter' | 'telegram')}
                        className="px-3 py-2 rounded-lg bg-black/40 text-white text-sm border border-white/10"
                    >
                        <option value="twitter">X (Twitter)</option>
                        <option value="telegram">Telegram</option>
                    </select>
                    <div className="flex-1 flex items-center gap-2">
                        <span className="text-gray-500">@</span>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="username"
                            className="flex-1 px-3 py-2 rounded-lg bg-black/40 text-white text-sm border border-white/10 focus:border-blue-400 outline-none"
                            onKeyDown={e => e.key === 'Enter' && handleScan()}
                        />
                    </div>
                    <button
                        onClick={handleScan}
                        disabled={loading || !username.trim()}
                        className="px-5 py-2 rounded-lg font-semibold text-sm text-white transition-all"
                        style={{
                            background: loading ? '#3b82f640' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            opacity: loading || !username.trim() ? 0.5 : 1,
                            cursor: loading ? 'wait' : 'pointer',
                        }}
                    >
                        {loading ? '⏳ Analyzing...' : '🔍 Analyze'}
                    </button>
                </div>

                {error && (
                    <p className="text-sm text-red-400 mt-2">{error}</p>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-4">
                    {/* Score Card */}
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <p className="text-lg font-bold text-white">
                                    @{result.username}
                                    {result.displayName && <span className="text-gray-400 ml-2">{result.displayName}</span>}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">{result.platform} · {result.dataSource}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold" style={{ color: result.score.credibilityScore >= 70 ? '#22c55e' : result.score.credibilityScore >= 40 ? '#eab308' : '#ef4444' }}>
                                    {result.score.credibilityScore}
                                    <span className="text-sm text-gray-400">/100</span>
                                </p>
                                <p className="text-xs text-gray-400">Credibility</p>
                            </div>
                        </div>

                        {/* Lie Score */}
                        <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-gray-300">🚨 Lie Score</span>
                                <span className="font-bold" style={{ color: result.score.lieScore >= 70 ? '#ef4444' : result.score.lieScore >= 40 ? '#f97316' : result.score.lieScore >= 20 ? '#eab308' : '#22c55e' }}>
                                    {result.score.lieScore}/100
                                </span>
                            </div>
                            <p className="text-sm font-medium" style={{ color: result.score.lieScore >= 70 ? '#ef4444' : result.score.lieScore >= 40 ? '#f97316' : '#eab308' }}>
                                {result.score.level}
                            </p>
                        </div>

                        {/* Profile Data */}
                        {result.profileData && (
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                                {result.profileData.followers && <div><span className="text-gray-500">Followers:</span> {result.profileData.followers}</div>}
                                {result.profileData.following && <div><span className="text-gray-500">Following:</span> {result.profileData.following}</div>}
                                {result.profileData.joined && <div><span className="text-gray-500">Joined:</span> {result.profileData.joined}</div>}
                                {result.profileData.postCount && <div><span className="text-gray-500">Posts:</span> {result.profileData.postCount}</div>}
                            </div>
                        )}

                        {/* Summary Stats */}
                        <div className="grid grid-cols-4 gap-2 text-center mb-3">
                            <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <p className="text-xl font-bold text-white">{result.score.breakdown.totalClaims}</p>
                                <p className="text-xs text-gray-500">Claims</p>
                            </div>
                            <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <p className="text-xl font-bold text-green-400">{result.score.breakdown.verified}</p>
                                <p className="text-xs text-gray-500">Verified</p>
                            </div>
                            <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <p className="text-xl font-bold text-red-400">{result.score.breakdown.contradicted}</p>
                                <p className="text-xs text-gray-500">Contradicted</p>
                            </div>
                            <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <p className="text-xl font-bold text-orange-400">{result.score.breakdown.deceptionSignals}</p>
                                <p className="text-xs text-gray-500">Red Flags</p>
                            </div>
                        </div>
                    </div>

                    {/* Deception Signals */}
                    {result.deceptionSignals.length > 0 && (
                        <div className="rounded-2xl p-5" style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <h3 className="text-sm font-bold text-red-400 mb-3">
                                🚨 Deception Signals ({result.deceptionSignals.length})
                            </h3>
                            <div className="space-y-3">
                                {result.deceptionSignals.map((sig, i) => (
                                    <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-sm" style={{ color: severityColors[sig.severity] }}>
                                                {sig.severity === 'critical' ? '🚫' : sig.severity === 'high' ? '⚠️' : '🔸'} {sig.signal.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: severityColors[sig.severity] + '20', color: severityColors[sig.severity] }}>
                                                +{sig.weight}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mb-1">{sig.description}</p>
                                        {sig.evidence && typeof sig.evidence === 'object' && sig.evidence.note && (
                                            <p className="text-xs text-gray-500 italic">→ {sig.evidence.note}</p>
                                        )}
                                        {sig.evidence && Array.isArray(sig.evidence) && sig.evidence.slice(0, 2).map((ev, j) => (
                                            <p key={j} className="text-xs text-gray-500 italic">→ {typeof ev === 'string' ? ev : JSON.stringify(ev).slice(0, 150)}</p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Claims Detail */}
                    {result.claims.length > 0 && (
                        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h3 className="text-sm font-bold text-white mb-3">
                                📝 Falsifiable Claims ({result.claims.length})
                            </h3>
                            <div className="space-y-2">
                                {result.claims.slice(0, 15).map((claim, i) => (
                                    <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-sm font-medium text-white">
                                                {statusEmoji[claim.verificationStatus] || '❓'} {claim.type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs text-gray-500">+{claim.weight}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mb-1" style={{ fontStyle: 'italic' }}>
                                            "{claim.excerpt.slice(0, 150)}"
                                        </p>
                                        <div className="flex justify-between text-xs text-gray-600">
                                            <span>{claim.date ? new Date(claim.date).toLocaleDateString() : 'unknown'}</span>
                                            <span className="capitalize">{claim.verificationStatus}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No posts notice */}
                    {result.postsAnalyzed === 0 && result.deceptionSignals.length === 0 && (
                        <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-sm text-gray-400">
                                ⚠️ No visible posts found for @{result.username}. The account may be private, suspended, or have deleted its post history.
                            </p>
                        </div>
                    )}

                    {/* Disclaimer */}
                    <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            📋 <span className="text-yellow-400 font-semibold">Disclaimer:</span> {result.disclaimer || 'Educational purposes only. Not financial advice. Not a guarantee of deception. Always DYOR.'}
                            <br />Scan date: {new Date(result.scanDate).toLocaleString()}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}