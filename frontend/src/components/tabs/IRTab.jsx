import './IRTab.css'

function highlightIR(line) {
  const keywords = ['DECL', 'STORE', 'PRINT', 'RET', 'JMPF', 'JMP', 'CALL']

  if (/^FUNC\s/.test(line)) return <span className="ir-func">{line}</span>
  if (/^LABEL\s|^END_FUNC\s/.test(line)) return <span className="ir-label">{line}</span>

  let parts = line
  for (const kw of keywords) {
    if (line.startsWith(kw + ' ') || line === kw) {
      parts = (
        <>
          <span className="ir-keyword">{kw}</span>
          {line.slice(kw.length).replace(/\b(t\d+)\b/g, '«$1»')}
        </>
      )
      break
    }
  }

  // If still a string, apply temp var highlighting
  if (typeof parts === 'string') {
    parts = line.replace(/\b(t\d+)\b/g, '«$1»')
  }

  return parts
}

export default function IRTab({ result }) {
  if (!result) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚙️</div>
        <h3>Intermediate Representation</h3>
        <p>3-address IR code will be generated here</p>
      </div>
    )
  }

  const ir = result.stages?.ir
  if (ir?.status === 'error') {
    return (
      <div className="result-section errors">
        <div className="result-section-header">❌ IR Generation Error</div>
        <div className="result-item"><span className="bullet">•</span> {ir.error}</div>
      </div>
    )
  }

  const instructions = ir?.instructions || []
  if (instructions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚙️</div>
        <h3>No IR Generated</h3>
        <p>Compile your code to see intermediate representation</p>
      </div>
    )
  }

  return (
    <div className="ir-view">
      {instructions.map((instr, i) => {
        // Replace «t1» markers with styled spans using dangerouslySetInnerHTML
        const htmlContent = instr
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\b(t\d+)\b/g, '<span class="ir-temp">$1</span>')

        let className = 'ir-instr'
        if (/^FUNC\s/.test(instr)) className = 'ir-instr ir-func'
        else if (/^LABEL\s|^END_FUNC\s/.test(instr)) className = 'ir-instr ir-label'
        else {
          const kws = ['DECL', 'STORE', 'PRINT', 'RET', 'JMPF', 'JMP', 'CALL']
          for (const kw of kws) {
            if (instr.startsWith(kw + ' ') || instr === kw) {
              const rest = instr.slice(kw.length)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\b(t\d+)\b/g, '<span class="ir-temp">$1</span>')
              return (
                <div className="ir-line" key={i}>
                  <span className="ir-num">{i + 1}</span>
                  <span className="ir-instr">
                    <span className="ir-keyword">{kw}</span>
                    <span dangerouslySetInnerHTML={{ __html: rest }} />
                  </span>
                </div>
              )
            }
          }
        }

        return (
          <div className="ir-line" key={i}>
            <span className="ir-num">{i + 1}</span>
            <span className={className} dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        )
      })}
    </div>
  )
}
