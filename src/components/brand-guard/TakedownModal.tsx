import { useState } from 'react';

interface TakedownModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanId: string;
  scanType: string;
  riskScore: number;
  riskLevel: string;
  evidence: {
    urls?: string[];
    descriptions?: string;
  };
  brand: {
    name: string;
    website: string;
  };
  violator: {
    platform: string;
    url: string;
    handle?: string;
    name?: string;
  };
  user: {
    id: string;
    email: string;
    companyName: string;
  };
}

const PLATFORMS = [
  { id: 'shopify', label: 'Shopify', icon: '🛍️' },
  { id: 'etsy', label: 'Etsy', icon: '🎨' },
  { id: 'registrar', label: 'Domain Registrar', icon: '🌐' },
  { id: 'twitter', label: 'X (Twitter)', icon: '🐦' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👤' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
  { id: 'dmca', label: 'Generic DMCA', icon: '📄' },
];

export function TakedownModal({
  isOpen, onClose, scanId, scanType, riskScore, riskLevel,
  evidence, brand, violator, user
}: TakedownModalProps) {

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [platformFormUrl, setPlatformFormUrl] = useState('');
  const [, setReportId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const API_BASE = '/api/brand-guard';

  async function generateReport() {
    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE}/takedown/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId, scanType, platform: selectedPlatform,
          riskScore, riskLevel, evidence, brand, violator, user
        })
      });
      const data = await response.json();
      setReportContent(data.renderedMarkdown);
      setMissingFields(data.missingFields || []);
      setPlatformFormUrl(data.platformFormUrl);
      setReportId(data.reportId);
      setStep(2);
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(reportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-green-500/30 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-green-400">Generate Takedown Report</h2>
            <p className="text-sm text-gray-400 mt-1">
              Risk: <span className="text-red-400 font-medium uppercase">{riskLevel}</span>
              {' '}({riskScore}/100)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Step 1: Platform selector */}
        {step === 1 && (
          <div className="p-6 overflow-y-auto flex-1">
            <p className="text-gray-300 mb-4">Which platform do you want to report to?</p>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                    ${selectedPlatform === p.id
                      ? 'border-green-400 bg-green-400/10 text-white'
                      : 'border-gray-600 text-gray-300 hover:border-gray-400'}`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Review report */}
        {step === 2 && (
          <div className="p-6 overflow-y-auto flex-1">
            {missingFields.length > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-4">
                <p className="text-yellow-400 font-medium mb-2">
                  ⚠️ {missingFields.length} field{missingFields.length > 1 ? 's' : ''} to fill in:
                </p>
                <ul className="text-yellow-300 text-sm list-disc list-inside space-y-1">
                  {missingFields.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
            <textarea
              value={reportContent}
              onChange={e => setReportContent(e.target.value)}
              className="w-full h-96 bg-gray-800 text-gray-200 text-sm p-4 rounded-lg border border-gray-600 font-mono resize-none focus:border-green-400 focus:outline-none"
            />
          </div>
        )}

        {/* Footer actions */}
        <div className="p-6 border-t border-gray-700 flex gap-3 flex-wrap">
          {step === 1 && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={generateReport}
                disabled={!selectedPlatform || isGenerating}
                className="ml-auto px-6 py-2 bg-green-500 text-black font-bold rounded-lg
                  hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : 'Generate Report →'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-400 hover:text-white">
                ← Back
              </button>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-white"
              >
                {copied ? '✓ Copied!' : 'Copy Text'}
              </button>
              <a
                href={platformFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400"
              >
                Open Submission Form →
              </a>
            </>
          )}
        </div>

      </div>
    </div>
  );
}