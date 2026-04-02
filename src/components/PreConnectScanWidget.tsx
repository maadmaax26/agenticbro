/**
 * PreConnectScanWidget.tsx
 * Scam detection widget for pre-wallet-connect section.
 * Allows 3 free scans tracked via localStorage.
 * Supports EN, ZH, JA, DE, FR, ES languages.
 */

import { useState } from 'react'
import { AlertTriangle, Search, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const SCAN_STORAGE_KEY = 'preconnect_scan_count'
const FREE_SCANS = 3

interface ScanResult {
  risk_score: number
  verdict: string
  red_flags: string[]
  is_known_scam: boolean
  victim_reports: number
  platform?: string
  username?: string
}

type Locale = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es'

const T: Record<Locale, Record<string, string | ((n: number) => string)>> = {
  en: {
    title: 'Free Scam Detection Scan',
    subtitle: 'Check any Telegram or Twitter username before you invest',
    placeholder: 'Enter username (e.g. @cryptoguru)',
    platform_label: 'Platform',
    scan_btn: 'Scan Now',
    scanning: 'Scanning...',
    scans_left: (n: number) => `${n} free scan${n !== 1 ? 's' : ''} remaining`,
    no_scans: 'No free scans left — connect wallet to continue',
    risk_score: 'Risk Score',
    verdict: 'Verdict',
    red_flags: 'Red Flags',
    known_scam: 'Known Scam',
    victim_reports: 'Victim Reports',
    safe: 'SAFE',
    suspicious: 'SUSPICIOUS',
    danger: 'HIGH RISK',
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    error: 'Scan failed. Please try again.',
    cta: 'Connect wallet for unlimited scans',
  },
  zh: {
    title: '免费诈骗检测扫描',
    subtitle: '在投资前检查任何 Telegram 或 Twitter 用户名',
    placeholder: '输入用户名 (例如 @cryptoguru)',
    platform_label: '平台',
    scan_btn: '立即扫描',
    scanning: '扫描中...',
    scans_left: (n: number) => `剩余 ${n} 次免费扫描`,
    no_scans: '免费扫描次数已用完 — 连接钱包继续',
    risk_score: '风险评分',
    verdict: '判断',
    red_flags: '风险信号',
    known_scam: '已知诈骗',
    victim_reports: '受害者报告',
    safe: '安全',
    suspicious: '可疑',
    danger: '高风险',
    low: '低',
    medium: '中',
    high: '高',
    error: '扫描失败，请重试。',
    cta: '连接钱包以无限扫描',
  },
  ja: {
    title: '無料詐欺検出スキャン',
    subtitle: '投資前にTelegramやTwitterのユーザー名を確認',
    placeholder: 'ユーザー名を入力 (例: @cryptoguru)',
    platform_label: 'プラットフォーム',
    scan_btn: '今すぐスキャン',
    scanning: 'スキャン中...',
    scans_left: (n: number) => `残り${n}回の無料スキャン`,
    no_scans: '無料スキャンがありません — ウォレットを接続してください',
    risk_score: 'リスクスコア',
    verdict: '判定',
    red_flags: '危険シグナル',
    known_scam: '既知の詐欺',
    victim_reports: '被害者報告',
    safe: '安全',
    suspicious: '疑わしい',
    danger: '高リスク',
    low: '低',
    medium: '中',
    high: '高',
    error: 'スキャンに失敗しました。もう一度お試しください。',
    cta: '無制限スキャンはウォレット接続',
  },
  de: {
    title: 'Kostenloser Betrugscheck',
    subtitle: 'Telegram- oder Twitter-Nutzernamen vor der Investition prüfen',
    placeholder: 'Nutzernamen eingeben (z.B. @cryptoguru)',
    platform_label: 'Plattform',
    scan_btn: 'Jetzt scannen',
    scanning: 'Scanne...',
    scans_left: (n: number) => `${n} kostenlose${n !== 1 ? '' : 'r'} Scan${n !== 1 ? 's' : ''} verbleibend`,
    no_scans: 'Keine kostenlosen Scans mehr — Wallet verbinden',
    risk_score: 'Risikobewertung',
    verdict: 'Urteil',
    red_flags: 'Warnsignale',
    known_scam: 'Bekannter Betrug',
    victim_reports: 'Opferberichte',
    safe: 'SICHER',
    suspicious: 'VERDÄCHTIG',
    danger: 'HOHES RISIKO',
    low: 'NIEDRIG',
    medium: 'MITTEL',
    high: 'HOCH',
    error: 'Scan fehlgeschlagen. Bitte erneut versuchen.',
    cta: 'Wallet verbinden für unbegrenzte Scans',
  },
  fr: {
    title: 'Scan Anti-Arnaque Gratuit',
    subtitle: 'Vérifiez tout pseudo Telegram ou Twitter avant d\'investir',
    placeholder: 'Entrez un pseudo (ex: @cryptoguru)',
    platform_label: 'Plateforme',
    scan_btn: 'Scanner maintenant',
    scanning: 'Scan en cours...',
    scans_left: (n: number) => `${n} scan${n !== 1 ? 's' : ''} gratuit${n !== 1 ? 's' : ''} restant${n !== 1 ? 's' : ''}`,
    no_scans: 'Plus de scans gratuits — connectez votre wallet',
    risk_score: 'Score de risque',
    verdict: 'Verdict',
    red_flags: 'Signaux d\'alerte',
    known_scam: 'Arnaque connue',
    victim_reports: 'Rapports de victimes',
    safe: 'SÛR',
    suspicious: 'SUSPECT',
    danger: 'RISQUE ÉLEVÉ',
    low: 'FAIBLE',
    medium: 'MOYEN',
    high: 'ÉLEVÉ',
    error: 'Échec du scan. Veuillez réessayer.',
    cta: 'Connecter le wallet pour des scans illimités',
  },
  es: {
    title: 'Escaneo Anti-Estafa Gratuito',
    subtitle: 'Verifica cualquier usuario de Telegram o Twitter antes de invertir',
    placeholder: 'Introduce un usuario (ej: @cryptoguru)',
    platform_label: 'Plataforma',
    scan_btn: 'Escanear ahora',
    scanning: 'Escaneando...',
    scans_left: (n: number) => `${n} escaneo${n !== 1 ? 's' : ''} gratuito${n !== 1 ? 's' : ''} restante${n !== 1 ? 's' : ''}`,
    no_scans: 'No quedan escaneos gratuitos — conecta tu wallet',
    risk_score: 'Puntuación de riesgo',
    verdict: 'Veredicto',
    red_flags: 'Señales de alerta',
    known_scam: 'Estafa conocida',
    victim_reports: 'Informes de víctimas',
    safe: 'SEGURO',
    suspicious: 'SOSPECHOSO',
    danger: 'ALTO RIESGO',
    low: 'BAJO',
    medium: 'MEDIO',
    high: 'ALTO',
    error: 'Error en el escaneo. Por favor, inténtalo de nuevo.',
    cta: 'Conecta tu wallet para escaneos ilimitados',
  },
}

function getRiskColor(score: number): string {
  if (score < 30) return '#22c55e'
  if (score < 70) return '#f59e0b'
  return '#ef4444'
}

function getRiskLabel(score: number, t: Record<string, unknown>): string {
  if (score < 30) return t.low as string
  if (score < 70) return t.medium as string
  return t.high as string
}

interface Props {
  lang?: string
}

export default function PreConnectScanWidget({ lang = 'en' }: Props) {
  const locale: Locale = (Object.keys(T).includes(lang) ? lang : 'en') as Locale
  const t = T[locale]

  const [username, setUsername] = useState('')
  const [platform, setPlatform] = useState<'telegram' | 'twitter'>('telegram')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')
  const [scansUsed, setScansUsed] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(SCAN_STORAGE_KEY) || '0', 10)
    } catch {
      return 0
    }
  })

  const scansLeft = FREE_SCANS - scansUsed
  const canScan = scansLeft > 0 && !scanning

  async function handleScan() {
    if (!username.trim() || !canScan) return
    setScanning(true)
    setError('')
    setResult(null)

    const cleanUser = username.replace(/^@/, '').trim()
    const newCount = scansUsed + 1

    try {
      const resp = await fetch('/api/scam-investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, platform })
      })
      if (!resp.ok) throw new Error('API error ' + resp.status)
      const data = await resp.json()
      setResult({
        risk_score: data.risk_score ?? 0,
        verdict: data.verdict ?? 'Unknown',
        red_flags: data.red_flags ?? [],
        is_known_scam: data.is_known_scam ?? false,
        victim_reports: data.victim_reports ?? 0,
        platform,
        username: cleanUser,
      })
      setScansUsed(newCount)
      localStorage.setItem(SCAN_STORAGE_KEY, String(newCount))
    } catch (e) {
      setError(t.error as string)
    } finally {
      setScanning(false)
    }
  }

  const riskColor = result ? getRiskColor(result.risk_score) : '#6b7280'

  return (
    <div className="w-full max-w-2xl mx-auto my-10 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-500/20">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">{t.title as string}</h3>
          <p className="text-xs text-gray-400">{t.subtitle as string}</p>
        </div>
        <div className="ml-auto text-right">
          {scansLeft > 0 ? (
            <span className="text-xs text-purple-300 font-semibold">
              {(t.scans_left as (n: number) => string)(scansLeft)}
            </span>
          ) : (
            <span className="text-xs text-red-400 font-semibold">{t.no_scans as string}</span>
          )}
        </div>
      </div>

      {/* Input Row */}
      <div className="flex gap-2 mb-4">
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value as 'telegram' | 'twitter')}
          disabled={!canScan}
          className="rounded-lg border border-white/10 bg-gray-900 text-gray-200 text-xs px-2 py-2 outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="telegram">Telegram</option>
          <option value="twitter">Twitter/X</option>
        </select>

        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleScan() }}
          placeholder={t.placeholder as string}
          disabled={!canScan}
          className="flex-1 rounded-lg border border-white/10 bg-gray-900 text-gray-200 text-xs px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
        />

        <button
          onClick={handleScan}
          disabled={!canScan || !username.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff' }}
        >
          {scanning ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.scanning as string}</>
          ) : (
            <><Search className="w-3.5 h-3.5" />{t.scan_btn as string}</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-xs mb-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-white/10 bg-gray-900/60 p-4 space-y-3">
          {/* Risk Score Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{t.risk_score as string}</span>
                <span className="font-bold" style={{ color: riskColor }}>
                  {result.risk_score}/100 — {getRiskLabel(result.risk_score, t)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${result.risk_score}%`, background: riskColor }}
                />
              </div>
            </div>
            <div className="p-2 rounded-lg" style={{ background: riskColor + '20' }}>
              {result.risk_score < 30
                ? <CheckCircle className="w-5 h-5" style={{ color: riskColor }} />
                : <XCircle className="w-5 h-5" style={{ color: riskColor }} />}
            </div>
          </div>

          {/* Verdict */}
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">{t.verdict as string}</span>
            <span className="font-bold" style={{ color: riskColor }}>{result.verdict}</span>
          </div>

          {/* Known scam + victim reports */}
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">{t.known_scam as string}:</span>
              <span className="font-bold" style={{ color: result.is_known_scam ? '#ef4444' : '#22c55e' }}>
                {result.is_known_scam ? '⚠ YES' : '✓ NO'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">{t.victim_reports as string}:</span>
              <span className="font-bold text-orange-400">{result.victim_reports}</span>
            </div>
          </div>

          {/* Red Flags */}
          {result.red_flags.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t.red_flags as string}:</p>
              <ul className="space-y-1">
                {result.red_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-orange-300">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* View Profile in browser tab — all platforms except Telegram */}
          {result.platform !== 'telegram' && result.username && (() => {
            const profileUrls: Record<string, string> = {
              twitter: `https://x.com/${result.username}`,
              instagram: `https://instagram.com/${result.username}`,
              discord: `https://discord.com/users/${result.username}`,
              linkedin: `https://linkedin.com/in/${result.username}`,
              facebook: `https://facebook.com/${result.username}`,
            };
            const url = profileUrls[result.platform ?? ''];
            return url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
              >
                🌐 View Profile in Browser Tab
              </a>
            ) : null;
          })()}
        </div>
      )}

      {/* CTA */}
      {scansLeft === 0 && (
        <div className="mt-3 text-center">
          <p className="text-xs text-purple-400 font-semibold">{t.cta as string} →</p>
        </div>
      )}
    </div>
  )
}
