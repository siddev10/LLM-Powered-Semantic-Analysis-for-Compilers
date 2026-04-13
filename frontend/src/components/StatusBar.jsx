import './StatusBar.css'

export default function StatusBar({ result, code }) {
  const verdict = result?.verdict || 'Ready'
  const dotClass = verdict === 'Ready' ? '' : verdict.toLowerCase()

  const total = result
    ? Object.values(result.timing || {}).reduce((a, b) => a + b, 0)
    : 0

  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className="status-item">
          <span className={`status-dot ${dotClass}`} />
          {verdict}
        </span>
      </div>
      <div className="status-center">
        {result && (
          <span className="status-item">Compiled in {(total * 1000).toFixed(0)}ms</span>
        )}
      </div>
      <div className="status-right">
        <span className="status-item">{code.split('\n').length} lines</span>
        <span className="status-item">src</span>
      </div>
    </footer>
  )
}
