import './Header.css'

const STAGES = [
  { key: 'frontend',    icon: '⚡', label: 'Lex/Parse' },
  { key: 'typechecker', icon: '🔍', label: 'Types' },
  { key: 'llm',         icon: '🤖', label: 'LLM' },
  { key: 'ir',          icon: '⚙️', label: 'IR' },
]

export default function Header({ pipelineState, backendStatus, onSettingsClick }) {
  const backend = backendStatus || {}
  const hasKey = backend.has_api_key
  const badgeClass = hasKey ? 'connected' : 'disconnected'

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="url(#lg)" strokeWidth="2" fill="none"/>
              <path d="M16 8L22 11.5V18.5L16 22L10 18.5V11.5L16 8Z" fill="url(#lg)" opacity="0.3"/>
              <path d="M16 11L19 13V17L16 19L13 17V13L16 11Z" fill="url(#lg)"/>
              <defs>
                <linearGradient id="lg" x1="4" y1="2" x2="28" y2="30">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#a855f7"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="logo-text">
            <h1>Semantic Compiler</h1>
            <span className="logo-sub">LLM-Powered · Flex + Bison + Python</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="pipeline-mini">
          {STAGES.map((s, i) => (
            <div key={s.key} className="pipe-group">
              {i > 0 && <span className="pipe-arrow">→</span>}
              <div className={`pipe-stage ${pipelineState[s.key] || ''}`}
                   title={s.label}>
                <span className="pipe-icon">{s.icon}</span>
                <span className="pipe-label">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="header-right">
        <div className={`backend-badge ${badgeClass}`} title="LLM Backend">
          <span className="badge-dot" />
          <span className="badge-text">
            {backend.llm_backend || 'Checking...'}
          </span>
        </div>
        <button className="btn-icon" onClick={onSettingsClick} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.4 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.4a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
