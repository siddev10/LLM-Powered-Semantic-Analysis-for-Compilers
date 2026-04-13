import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import Header from './components/Header'
import Toolbar from './components/Toolbar'
import CodePanel from './components/CodePanel'
import OutputPanel from './components/OutputPanel'
import StatusBar from './components/StatusBar'
import SettingsModal from './components/SettingsModal'
import CompileOverlay from './components/CompileOverlay'
import Toast from './components/Toast'
import './App.css'

const DEFAULT_CODE = `// LLM Compiler test program
// Supports: int, float, string, bool, if/else, while, functions

func int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int x = 10;
int result = factorial(x);
print(result);
`

export default function App() {
  const [code, setCode] = useState(() => {
    return localStorage.getItem('compiler-ide-code') || DEFAULT_CODE
  })
  const [result, setResult] = useState(null)
  const [compiling, setCompiling] = useState(false)
  const [activeTab, setActiveTab] = useState('ast')
  const [llmEnabled, setLlmEnabled] = useState(true)
  const [backendStatus, setBackendStatus] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [toasts, setToasts] = useState([])
  const [pipelineState, setPipelineState] = useState({})
  const [editorWidth, setEditorWidth] = useState(50) // percentage
  const resizerRef = useRef(null)
  const layoutRef = useRef(null)

  // ── Toast helper ──
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ── Check backend status ──
  useEffect(() => {
    axios.get('/status')
      .then(res => setBackendStatus(res.data))
      .catch(() => setBackendStatus({ has_api_key: false, llm_backend: 'Server offline', binary_exists: false }))
  }, [])

  // ── Save code to localStorage ──
  useEffect(() => {
    localStorage.setItem('compiler-ide-code', code)
  }, [code])

  // ── Compile ──
  const compile = useCallback(async () => {
    if (!code.trim()) {
      addToast('Please write some code first!', 'error')
      return
    }
    setCompiling(true)
    setPipelineState({ frontend: 'active' })

    try {
      const res = await axios.post('/compile', {
        source: code,
        skip_llm: !llmEnabled,
      })
      setResult(res.data)
      updatePipelineFromResult(res.data)
      autoSelectTab(res.data)
      addToast(`Compiled in ${totalTime(res.data)}ms`, 'success')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      addToast(`Compilation failed: ${msg}`, 'error')
      setPipelineState({})
    } finally {
      setCompiling(false)
    }
  }, [code, llmEnabled, addToast])

  // ── Keyboard shortcut ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        compile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [compile])

  // ── Pipeline state from result ──
  function updatePipelineFromResult(r) {
    const s = r.stages || {}
    const state = {}
    for (const [name, data] of Object.entries(s)) {
      if (data.status === 'error') state[name] = 'error'
      else if (data.status === 'skipped') state[name] = 'neutral'
      else if (name === 'typechecker' && data.errors?.length > 0) state[name] = 'error'
      else if (name === 'typechecker' && data.warnings?.length > 0) state[name] = 'warning'
      else if (name === 'llm') {
        const v = data.analysis?.verdict
        if (v === 'FAIL') state[name] = 'error'
        else if (v === 'WARNINGS') state[name] = 'warning'
        else state[name] = 'success'
      }
      else state[name] = 'success'
    }
    setPipelineState(state)
  }

  function autoSelectTab(r) {
    const front = r.stages?.frontend
    if (front?.status === 'error') { setActiveTab('ast'); return }
    const tc = r.stages?.typechecker
    if (tc?.errors?.length > 0) { setActiveTab('types'); return }
    const llm = r.stages?.llm
    if (llm?.analysis?.verdict === 'FAIL' || llm?.analysis?.verdict === 'WARNINGS') {
      setActiveTab('llm'); return
    }
    setActiveTab('ast')
  }

  function totalTime(r) {
    return Object.values(r.timing || {}).reduce((a, b) => a + b, 0).toFixed(0) * 1000 | 0
  }

  // ── Clear ──
  const clearOutput = useCallback(() => {
    setResult(null)
    setPipelineState({})
    setActiveTab('ast')
    addToast('Output cleared', 'info')
  }, [addToast])

  // ── Load sample ──
  const loadSample = useCallback((sample) => {
    setCode(sample.code)
    addToast(`Loaded: ${sample.name}`, 'info')
  }, [addToast])

  // ── API key set ──
  const setApiKey = useCallback(async (provider, key) => {
    try {
      await axios.post('/set-key', { provider, key })
      addToast(`${provider} API key set!`, 'success')
      const res = await axios.get('/status')
      setBackendStatus(res.data)
    } catch (err) {
      addToast('Failed to set API key', 'error')
    }
  }, [addToast])

  // ── Resizer ──
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    const layout = layoutRef.current
    if (!layout) return

    const onMouseMove = (e) => {
      const rect = layout.getBoundingClientRect()
      let pct = ((e.clientX - rect.left) / rect.width) * 100
      pct = Math.max(25, Math.min(75, pct))
      setEditorWidth(pct)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div className="app">
      {/* Background effects */}
      <div className="bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="bg-grid" />
      </div>

      <Header
        pipelineState={pipelineState}
        backendStatus={backendStatus}
        onSettingsClick={() => setShowSettings(true)}
      />

      <Toolbar
        onCompile={compile}
        onClear={clearOutput}
        onLoadSample={loadSample}
        llmEnabled={llmEnabled}
        setLlmEnabled={setLlmEnabled}
        compiling={compiling}
      />

      <main className="ide-layout" ref={layoutRef}>
        <div className="panel panel-editor" style={{ width: `${editorWidth}%` }}>
          <CodePanel code={code} setCode={setCode} />
        </div>
        <div
          className="panel-resizer"
          ref={resizerRef}
          onMouseDown={onMouseDown}
        />
        <div className="panel panel-output" style={{ width: `${100 - editorWidth}%` }}>
          <OutputPanel
            result={result}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
      </main>

      <StatusBar result={result} code={code} />

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSetKey={setApiKey}
          backendStatus={backendStatus}
        />
      )}

      {compiling && <CompileOverlay />}

      <Toast toasts={toasts} />
    </div>
  )
}
