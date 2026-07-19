/**
 * RiskBadge.tsx — Risk Score Visualization
 * 
 * Displays risk scores as colored badges with optional explanation.
 */

import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskBadgeProps {
  score: number;
  level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showExplanation?: boolean;
  explanation?: string;
  className?: string;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function getRiskConfig(level: RiskBadgeProps['level']) {
  switch (level) {
    case 'SAFE':
      return {
        color: 'bg-green-500',
        textColor: 'text-green-400',
        bgColor: 'bg-green-900/30',
        borderColor: 'border-green-500/30',
        icon: CheckCircle,
        label: 'Safe',
      };
    case 'LOW':
      return {
        color: 'bg-lime-500',
        textColor: 'text-lime-400',
        bgColor: 'bg-lime-900/30',
        borderColor: 'border-lime-500/30',
        icon: Shield,
        label: 'Low Risk',
      };
    case 'MEDIUM':
      return {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-400',
        bgColor: 'bg-yellow-900/30',
        borderColor: 'border-yellow-500/30',
        icon: AlertTriangle,
        label: 'Medium Risk',
      };
    case 'HIGH':
      return {
        color: 'bg-orange-500',
        textColor: 'text-orange-400',
        bgColor: 'bg-orange-900/30',
        borderColor: 'border-orange-500/30',
        icon: AlertTriangle,
        label: 'High Risk',
      };
    case 'CRITICAL':
      return {
        color: 'bg-red-500',
        textColor: 'text-red-400',
        bgColor: 'bg-red-900/30',
        borderColor: 'border-red-500/30',
        icon: XCircle,
        label: 'Critical',
      };
    default:
      return {
        color: 'bg-gray-500',
        textColor: 'text-gray-400',
        bgColor: 'bg-gray-900/30',
        borderColor: 'border-gray-500/30',
        icon: Shield,
        label: 'Unknown',
      };
  }
}

function getSizeConfig(size: RiskBadgeProps['size']) {
  switch (size) {
    case 'sm':
      return {
        badge: 'px-2 py-0.5 text-xs',
        icon: 'w-3 h-3',
        score: 'text-sm',
      };
    case 'lg':
      return {
        badge: 'px-4 py-2 text-lg',
        icon: 'w-8 h-8',
        score: 'text-3xl',
      };
    default:
      return {
        badge: 'px-3 py-1 text-sm',
        icon: 'w-5 h-5',
        score: 'text-xl',
      };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function RiskBadge({
  score,
  level,
  size = 'md',
  showLabel = true,
  showExplanation = false,
  explanation,
  className = '',
}: RiskBadgeProps) {
  const config = getRiskConfig(level);
  const sizeConfig = getSizeConfig(size);
  const Icon = config.icon;

  return (
    <div className={className}>
      {/* Main Badge */}
      <div
        className={`inline-flex items-center gap-2 rounded-lg border ${config.bgColor} ${config.borderColor} ${sizeConfig.badge}`}
      >
        <Icon className={`${sizeConfig.icon} ${config.textColor}`} />
        
        {/* Score */}
        <div className="flex items-center gap-1">
          <span className={`font-bold ${sizeConfig.score} ${config.textColor}`}>
            {score.toFixed(1)}
          </span>
          <span className="text-gray-500">/10</span>
        </div>

        {/* Label */}
        {showLabel && (
          <span className={`${config.textColor} font-medium`}>
            {config.label}
          </span>
        )}
      </div>

      {/* Explanation */}
      {showExplanation && explanation && (
        <div className="mt-2 text-sm text-gray-400 max-w-sm">
          {explanation}
        </div>
      )}
    </div>
  );
}

// ─── Score Bar Variant ────────────────────────────────────────────────────────────

interface RiskScoreBarProps {
  score: number;
  showScore?: boolean;
  className?: string;
}

export function RiskScoreBar({ score, showScore = true, className = '' }: RiskScoreBarProps) {
  const percentage = Math.min(100, Math.max(0, score * 10));
  
  // Color gradient from green to red
  const getGradient = () => {
    if (score <= 2) return 'from-green-500 to-green-400';
    if (score <= 4) return 'from-lime-500 to-lime-400';
    if (score <= 6) return 'from-yellow-500 to-yellow-400';
    if (score <= 8) return 'from-orange-500 to-orange-400';
    return 'from-red-500 to-red-400';
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Score */}
      {showScore && (
        <span className="text-sm font-bold text-white min-w-[3rem]">
          {score.toFixed(1)}
        </span>
      )}

      {/* Bar */}
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getGradient()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Scale */}
      <div className="flex gap-1 text-xs text-gray-500">
        <span>0</span>
        <span>|</span>
        <span>5</span>
        <span>|</span>
        <span>10</span>
      </div>
    </div>
  );
}

// ─── Compact Badge Variant ────────────────────────────────────────────────────────

interface CompactRiskBadgeProps {
  score: number;
  className?: string;
}

export function CompactRiskBadge({ score, className = '' }: CompactRiskBadgeProps) {
  const level = getLevelFromScore(score);
  const config = getRiskConfig(level);

  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor} border ${config.borderColor} ${className}`}
    >
      <span className={`text-sm font-bold ${config.textColor}`}>
        {score.toFixed(0)}
      </span>
    </span>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────────────

function getLevelFromScore(score: number): RiskBadgeProps['level'] {
  if (score <= 2) return 'SAFE';
  if (score <= 4) return 'LOW';
  if (score <= 6) return 'MEDIUM';
  if (score <= 8) return 'HIGH';
  return 'CRITICAL';
}

export default RiskBadge;
