import './CompileOverlay.css'

export default function CompileOverlay() {
  return (
    <div className="compile-overlay">
      <div className="compile-spinner">
        <div className="spinner-ring" />
        <div className="spinner-text">Compiling...</div>
        <div className="spinner-sub">Running pipeline stages</div>
      </div>
    </div>
  )
}
