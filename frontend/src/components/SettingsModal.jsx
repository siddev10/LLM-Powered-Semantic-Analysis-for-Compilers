import { useState } from 'react'
import './SettingsModal.css'

export default function SettingsModal({ onClose, onSetKey, backendStatus }) {
  const [groqKey, setGroqKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-icon modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>LLM API Keys</h3>
            <p className="settings-desc">
              Set an API key to enable LLM semantic analysis. Groq and Gemini are free.
            </p>

            <div className="form-group">
              <label>Groq API Key <span className="tag tag-free">FREE</span></label>
              <div className="input-row">
                <input type="password" placeholder="gsk_..." value={groqKey}
                  onChange={e => setGroqKey(e.target.value)} />
                <button className="btn-set" onClick={() => { onSetKey('groq', groqKey); setGroqKey('') }}>Set</button>
              </div>
              {backendStatus?.keys?.groq && <span className="key-active">✓ Active</span>}
            </div>

            <div className="form-group">
              <label>Gemini API Key <span className="tag tag-free">FREE</span></label>
              <div className="input-row">
                <input type="password" placeholder="AIzaSy..." value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)} />
                <button className="btn-set" onClick={() => { onSetKey('gemini', geminiKey); setGeminiKey('') }}>Set</button>
              </div>
              {backendStatus?.keys?.gemini && <span className="key-active">✓ Active</span>}
            </div>

            <div className="form-group">
              <label>Anthropic API Key <span className="tag tag-paid">PAID</span></label>
              <div className="input-row">
                <input type="password" placeholder="sk-ant-..." value={claudeKey}
                  onChange={e => setClaudeKey(e.target.value)} />
                <button className="btn-set" onClick={() => { onSetKey('claude', claudeKey); setClaudeKey('') }}>Set</button>
              </div>
              {backendStatus?.keys?.claude && <span className="key-active">✓ Active</span>}
            </div>
          </div>

          <div className="settings-section">
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcut-list">
              <div className="shortcut-item">
                <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
                <span className="shortcut-desc">Compile & Analyze</span>
              </div>
              <div className="shortcut-item">
                <span><kbd>Ctrl</kbd>+<kbd>S</kbd></span>
                <span className="shortcut-desc">Save to localStorage</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Tech Stack</h3>
            <div className="tech-stack">
              <span className="tech-badge react">React + Vite</span>
              <span className="tech-badge fastapi">FastAPI</span>
              <span className="tech-badge monaco">Monaco Editor</span>
              <span className="tech-badge axios">Axios + CORS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
