import ASTViewer from './tabs/ASTViewer'
import TypesTab from './tabs/TypesTab'
import LLMTab from './tabs/LLMTab'
import IRTab from './tabs/IRTab'
import TimingTab from './tabs/TimingTab'
import './OutputPanel.css'

const TABS = [
  { key: 'ast',    icon: '🌳', label: 'AST' },
  { key: 'types',  icon: '🔍', label: 'Types' },
  { key: 'llm',    icon: '🤖', label: 'LLM' },
  { key: 'ir',     icon: '⚙️', label: 'IR Code' },
  { key: 'timing', icon: '⏱️', label: 'Timing' },
]

function getBadge(key, result) {
  if (!result) return null
  const s = result.stages || {}

  if (key === 'ast') {
    if (s.frontend?.status === 'error') return { text: '!', type: 'error' }
    if (s.frontend?.ast) return { text: '✓', type: 'success' }
  }
  if (key === 'types') {
    const errs = s.typechecker?.errors?.length || 0
    const warns = s.typechecker?.warnings?.length || 0
    if (errs > 0) return { text: errs, type: 'error' }
    if (warns > 0) return { text: warns, type: 'warning' }
    if (s.typechecker?.status === 'success') return { text: '✓', type: 'success' }
  }
  if (key === 'llm') {
    const v = s.llm?.analysis?.verdict
    if (v === 'FAIL') return { text: 'FAIL', type: 'error' }
    if (v === 'WARNINGS') return { text: 'WARN', type: 'warning' }
    if (v === 'PASS') return { text: 'PASS', type: 'success' }
    if (s.llm?.status === 'skipped') return { text: '—', type: 'info' }
  }
  if (key === 'ir') {
    const n = s.ir?.instructions?.length
    if (n) return { text: n, type: 'info' }
  }
  return null
}

export default function OutputPanel({ result, activeTab, setActiveTab }) {
  return (
    <>
      <div className="output-tabs">
        {TABS.map(t => {
          const badge = getBadge(t.key, result)
          return (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
              {badge && (
                <span className={`tab-badge ${badge.type}`}>{badge.text}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="tab-content">
        {activeTab === 'ast'    && <ASTViewer result={result} />}
        {activeTab === 'types'  && <TypesTab result={result} />}
        {activeTab === 'llm'    && <LLMTab result={result} />}
        {activeTab === 'ir'     && <IRTab result={result} />}
        {activeTab === 'timing' && <TimingTab result={result} />}
      </div>
    </>
  )
}
