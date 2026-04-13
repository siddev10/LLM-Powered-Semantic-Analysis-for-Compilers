export default function TypesTab({ result }) {
  if (!result) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>Type Checker</h3>
        <p>Type errors and warnings will appear here</p>
      </div>
    )
  }

  const tc = result.stages?.typechecker
  if (tc?.status === 'error') {
    return (
      <div className="result-section errors">
        <div className="result-section-header">❌ Type Checker Error</div>
        <div className="result-item"><span className="bullet">•</span> {tc.error}</div>
      </div>
    )
  }

  const errors = tc?.errors || []
  const warnings = tc?.warnings || []

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="result-section success">
        <div className="result-section-header">✅ All Checks Passed</div>
        <div className="result-item"><span className="bullet">✓</span> No type errors or warnings detected.</div>
      </div>
    )
  }

  return (
    <>
      {errors.length > 0 && (
        <div className="result-section errors">
          <div className="result-section-header">
            ❌ {errors.length} Error{errors.length > 1 ? 's' : ''}
          </div>
          {errors.map((e, i) => (
            <div className="result-item" key={i}>
              <span className="bullet" style={{ color: 'var(--error)' }}>✗</span> {e}
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="result-section warnings">
          <div className="result-section-header">
            ⚠️ {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
          </div>
          {warnings.map((w, i) => (
            <div className="result-item" key={i}>
              <span className="bullet" style={{ color: 'var(--warning)' }}>⚠</span> {w}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
