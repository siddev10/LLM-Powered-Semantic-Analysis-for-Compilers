import './TimingTab.css'

const STAGES = [
  { key: 'frontend',    label: '⚡ Lexer + Parser',  color: '#6366f1' },
  { key: 'typechecker', label: '🔍 Type Checker',    color: '#a855f7' },
  { key: 'llm',         label: '🤖 LLM Analysis',    color: '#f59e0b' },
  { key: 'ir',          label: '⚙️ IR Generator',     color: '#06b6d4' },
]

export default function TimingTab({ result }) {
  if (!result) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏱️</div>
        <h3>Pipeline Timing</h3>
        <p>Execution time for each compiler stage</p>
      </div>
    )
  }

  const timing = result.timing || {}
  const total = Object.values(timing).reduce((a, b) => a + b, 0)
  const maxTime = Math.max(...Object.values(timing), 0.001)

  return (
    <div className="timing-view">
      {STAGES.map(s => {
        const t = timing[s.key]
        if (t === undefined) return null
        const pct = (t / maxTime) * 100
        return (
          <div className="timing-card" key={s.key}>
            <div className="timing-header">
              <span className="timing-name">{s.label}</span>
              <span className="timing-val">{(t * 1000).toFixed(1)}ms</span>
            </div>
            <div className="timing-bar-track">
              <div
                className="timing-bar-fill"
                style={{ width: `${pct}%`, background: s.color, animation: 'barGrow 0.8s ease' }}
              />
            </div>
          </div>
        )
      })}
      <div className="timing-total">
        <span className="timing-name">Total Pipeline</span>
        <span className="timing-val">{(total * 1000).toFixed(1)}ms</span>
      </div>
    </div>
  )
}
