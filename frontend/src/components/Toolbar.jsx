import { useState, useEffect } from 'react'
import axios from 'axios'
import './Toolbar.css'

export default function Toolbar({ onCompile, onClear, onLoadSample, llmEnabled, setLlmEnabled, compiling }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [samples, setSamples] = useState({})

  useEffect(() => {
    axios.get('/samples')
      .then(res => setSamples(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const close = () => setDropdownOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className={`dropdown ${dropdownOpen ? 'open' : ''}`}>
          <button
            className="btn btn-secondary"
            onClick={(e) => { e.stopPropagation(); setDropdownOpen(v => !v) }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <path d="M14 2v6h6"/><path d="M16 13H8"/>
            </svg>
            Sample Programs
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" className="chevron">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div className="dropdown-menu">
            {Object.entries(samples).map(([key, s]) => (
              <div
                key={key}
                className="dropdown-item"
                onClick={() => { onLoadSample(s); setDropdownOpen(false) }}
              >
                <span className="item-name">{s.name}</span>
                <span className="item-desc">{s.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="toolbar-center">
        <button
          className={`btn btn-primary btn-compile ${compiling ? 'compiling' : ''}`}
          onClick={onCompile}
          disabled={compiling}
        >
          {compiling ? (
            <span className="btn-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
          {compiling ? 'Compiling...' : 'Compile & Analyze'}
          <span className="shortcut">Ctrl+Enter</span>
        </button>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => setLlmEnabled(e.target.checked)}
          />
          <span className="toggle-slider" />
          <span className="toggle-text">LLM Analysis</span>
        </label>
      </div>

      <div className="toolbar-right">
        <button className="btn btn-ghost" onClick={onClear}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Clear
        </button>
      </div>
    </div>
  )
}
