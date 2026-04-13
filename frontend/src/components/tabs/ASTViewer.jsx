import { useState } from 'react'
import './ASTViewer.css'

function ASTNode({ node, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(depth > 3)

  if (node === null || node === undefined) {
    return <span className="ast-val null">null</span>
  }
  if (typeof node !== 'object') {
    const cls = typeof node === 'string' ? 'ast-str' : 'ast-val'
    return <span className={cls}>{JSON.stringify(node)}</span>
  }

  if (Array.isArray(node)) {
    return (
      <div className="ast-node">
        <div className="ast-node-inner" onClick={() => setCollapsed(c => !c)}>
          <span className={`ast-toggle ${collapsed ? 'collapsed' : ''}`}>▼</span>
          <span className="ast-prop">Array [{node.length}]</span>
        </div>
        {!collapsed && (
          <div className="ast-children">
            {node.map((item, i) => (
              <div className="ast-child" key={i}>
                <span className="ast-prop">[{i}]: </span>
                <ASTNode node={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Object
  const type = node.type || 'Object'
  const inlineKeys = ['name', 'varType', 'retType', 'op', 'dataType', 'value', 'paramType']
  const inlineProps = inlineKeys.filter(k => node[k] !== undefined && typeof node[k] !== 'object')
  const childKeys = Object.keys(node).filter(k => k !== 'type' && !(inlineKeys.includes(k) && typeof node[k] !== 'object'))

  return (
    <div className="ast-node">
      <div className="ast-node-inner" onClick={() => setCollapsed(c => !c)}>
        {childKeys.length > 0 ? (
          <span className={`ast-toggle ${collapsed ? 'collapsed' : ''}`}>▼</span>
        ) : (
          <span className="ast-toggle" style={{ visibility: 'hidden' }}>▼</span>
        )}
        <span className="ast-type">{type}</span>
        {inlineProps.map(k => (
          <span key={k} className="ast-inline">
            <span className="ast-prop">{k}:</span>{' '}
            <span className={typeof node[k] === 'string' ? 'ast-str' : 'ast-val'}>
              {JSON.stringify(node[k])}
            </span>
          </span>
        ))}
      </div>
      {childKeys.length > 0 && !collapsed && (
        <div className="ast-children">
          {childKeys.map(k => (
            <div className="ast-child" key={k}>
              <span className="ast-prop">{k}: </span>
              <ASTNode node={node[k]} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ASTViewer({ result }) {
  if (!result) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🌳</div>
        <h3>Abstract Syntax Tree</h3>
        <p>Write code and click <strong>Compile & Analyze</strong> to see the AST</p>
      </div>
    )
  }

  const frontend = result.stages?.frontend
  if (frontend?.status === 'error') {
    return (
      <div className="result-section errors">
        <div className="result-section-header">❌ Parse Error</div>
        <div className="result-item"><span className="bullet">•</span> {frontend.error}</div>
        {frontend.raw && (
          <div className="result-item" style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            {frontend.raw.substring(0, 500)}
          </div>
        )}
      </div>
    )
  }

  if (!frontend?.ast) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🌳</div>
        <h3>No AST Generated</h3>
        <p>The parser didn't produce an AST output.</p>
      </div>
    )
  }

  return (
    <div className="ast-viewer">
      <ASTNode node={frontend.ast} />
    </div>
  )
}
