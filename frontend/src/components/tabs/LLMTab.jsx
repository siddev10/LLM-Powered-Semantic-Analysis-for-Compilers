import './LLMTab.css'

const CATEGORIES = [
  { key: 'semantic_errors', label: 'Semantic Errors', icon: '🔴' },
  { key: 'logic_warnings',  label: 'Logic Warnings',  icon: '🟡' },
  { key: 'code_quality',    label: 'Code Quality',     icon: '🔷' },
  { key: 'optimisations',   label: 'Optimization Hints', icon: '🟢' },
]

export default function LLMTab({ result }) {
  if (!result) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🤖</div>
        <h3>LLM Semantic Analysis</h3>
        <p>AI-powered deep code analysis results</p>
      </div>
    )
  }

  const llm = result.stages?.llm
  if (llm?.status === 'skipped') {
    return (
      <div className="llm-skipped">
        <span className="llm-skipped-icon">🤖</span>
        <span>LLM analysis was skipped. Toggle it on and recompile.</span>
      </div>
    )
  }

  if (llm?.status === 'error') {
    return (
      <div className="result-section errors">
        <div className="result-section-header">❌ LLM Error</div>
        <div className="result-item"><span className="bullet">•</span> {llm.error}</div>
      </div>
    )
  }

  const analysis = llm?.analysis || {}
  const verdict = analysis.verdict || 'UNKNOWN'
  const verdictIcon = { PASS: '✅', WARNINGS: '⚠️', FAIL: '❌' }[verdict] || '❓'

  return (
    <div className="llm-results">
      <div className="llm-verdict-card">
        <div className="verdict-left">
          <span className="verdict-icon">{verdictIcon}</span>
          <div>
            <div className="verdict-label">Overall Verdict</div>
            <div className={`verdict-value ${verdict.toLowerCase()}`}>{verdict}</div>
          </div>
        </div>
      </div>

      {analysis.summary && (
        <div className="llm-summary">
          <strong>Summary: </strong>{analysis.summary}
        </div>
      )}

      {CATEGORIES.map(cat => {
        const items = analysis[cat.key] || []
        if (items.length === 0) return null
        return (
          <div className="llm-category" key={cat.key}>
            <div className="llm-cat-header">
              <span>{cat.icon}</span> {cat.label} ({items.length})
            </div>
            {items.map((item, i) => (
              <div className="llm-item" key={i}>
                • {typeof item === 'string' ? item : JSON.stringify(item)}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
