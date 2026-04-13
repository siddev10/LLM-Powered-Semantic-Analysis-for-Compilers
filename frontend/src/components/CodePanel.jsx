import { useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import './CodePanel.css'

export default function CodePanel({ code, setCode }) {
  const editorRef = useRef(null)

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // Register custom language for .src files
    monaco.languages.register({ id: 'srclang' })
    monaco.languages.setMonarchTokensProvider('srclang', {
      keywords: ['int', 'float', 'string', 'bool', 'if', 'else', 'while', 'for',
                 'return', 'func', 'print', 'true', 'false'],
      operators: ['==', '!=', '<=', '>=', '&&', '||', '!', '+', '-', '*', '/', '%', '=', '<', '>'],
      tokenizer: {
        root: [
          [/\/\/.*$/, 'comment'],
          [/"[^"]*"/, 'string'],
          [/\b(func|return|if|else|while|for|print)\b/, 'keyword'],
          [/\b(int|float|string|bool)\b/, 'type'],
          [/\b(true|false)\b/, 'constant'],
          [/\b\d+\.\d+\b/, 'number.float'],
          [/\b\d+\b/, 'number'],
          [/[a-zA-Z_]\w*/, 'identifier'],
          [/[{}()\[\]]/, '@brackets'],
          [/[;,]/, 'delimiter'],
          [/==|!=|<=|>=|&&|\|\||[+\-*/%=<>!]/, 'operator'],
        ],
      },
    })

    // Theme
    monaco.editor.defineTheme('compiler-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment',      foreground: '555570', fontStyle: 'italic' },
        { token: 'keyword',      foreground: 'c792ea', fontStyle: 'bold' },
        { token: 'type',         foreground: '82aaff' },
        { token: 'constant',     foreground: 'f78c6c' },
        { token: 'string',       foreground: 'c3e88d' },
        { token: 'number',       foreground: 'f78c6c' },
        { token: 'number.float', foreground: 'f78c6c' },
        { token: 'operator',     foreground: '89ddff' },
        { token: 'identifier',   foreground: 'eeffff' },
        { token: 'delimiter',    foreground: '89ddff' },
      ],
      colors: {
        'editor.background':                '#0a0a12',
        'editor.foreground':                '#eaeaf0',
        'editor.lineHighlightBackground':   '#6366f10a',
        'editor.selectionBackground':       '#6366f130',
        'editorCursor.foreground':          '#6366f1',
        'editorLineNumber.foreground':      '#3a3a55',
        'editorLineNumber.activeForeground':'#6366f1',
        'editorGutter.background':          '#08080e',
        'editorIndentGuide.background':     '#1a1a2e',
        'editor.selectionHighlightBackground': '#6366f118',
      },
    })

    monaco.editor.setTheme('compiler-dark')
    editor.focus()
  }, [])

  return (
    <>
      <div className="code-panel-header">
        <div className="code-panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>Source Code</span>
          <span className="file-badge">program.src</span>
        </div>
        <span className="char-count">{code.length} chars</span>
      </div>
      <div className="editor-container">
        <Editor
          defaultLanguage="srclang"
          theme="compiler-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          onMount={handleMount}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            lineHeight: 24,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            matchBrackets: 'always',
            folding: true,
            wordWrap: 'off',
            tabSize: 4,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>
    </>
  )
}
