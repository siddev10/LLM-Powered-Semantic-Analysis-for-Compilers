/* ═══════════════════════════════════════════════════════════════════
   Semantic Compiler IDE — Frontend Logic
   ═══════════════════════════════════════════════════════════════════ */

const API = "";  // Same origin

// ── State ─────────────────────────────────────────────────────────
let editor;
let compilationResult = null;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initEditor();
    initTabs();
    initDropdown();
    initResizer();
    initSettings();
    initKeyboard();
    checkStatus();
    loadSamples();
    restoreCode();

    document.getElementById("btn-compile").addEventListener("click", compile);
    document.getElementById("btn-clear").addEventListener("click", clearOutput);
    document.getElementById("btn-fullscreen").addEventListener("click", toggleFullscreen);
});


// ── CodeMirror ────────────────────────────────────────────────────
function initEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        mode: "text/x-csrc",
        theme: "material-darker",
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        tabSize: 4,
        indentUnit: 4,
        indentWithTabs: false,
        lineWrapping: false,
        extraKeys: {
            "Ctrl-Enter": compile,
            "Cmd-Enter": compile,
            "Ctrl-S": (cm) => { saveCode(); showToast("Code saved!", "success"); },
        }
    });

    editor.on("cursorActivity", () => {
        const pos = editor.getCursor();
        document.getElementById("status-line").textContent =
            `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
    });

    editor.on("change", () => {
        const len = editor.getValue().length;
        document.getElementById("char-count").textContent = `${len} chars`;
    });

    // Set default code
    const defaultCode = `// LLM Compiler test program
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
`;
    editor.setValue(defaultCode);
    editor.refresh();
    setTimeout(() => editor.refresh(), 100);
}


// ── Tabs ──────────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`content-${target}`).classList.add("active");
        });
    });
}


// ── Sample Programs Dropdown ──────────────────────────────────────
function initDropdown() {
    const btn = document.getElementById("btn-samples");
    const dropdown = document.getElementById("samples-dropdown");

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    });

    document.addEventListener("click", () => {
        dropdown.classList.remove("open");
    });
}

async function loadSamples() {
    try {
        const res = await fetch(`${API}/api/samples`);
        const samples = await res.json();
        const menu = document.getElementById("samples-menu");
        menu.innerHTML = "";

        for (const [key, sample] of Object.entries(samples)) {
            const item = document.createElement("div");
            item.className = "dropdown-item";
            item.innerHTML = `
                <span class="item-name">${sample.name}</span>
                <span class="item-desc">${sample.description}</span>
            `;
            item.addEventListener("click", () => {
                editor.setValue(sample.code);
                document.getElementById("file-badge").textContent = `${key}.src`;
                document.getElementById("samples-dropdown").classList.remove("open");
                showToast(`Loaded: ${sample.name}`, "info");
            });
            menu.appendChild(item);
        }
    } catch (e) {
        console.error("Failed to load samples:", e);
    }
}


// ── Panel Resizer ─────────────────────────────────────────────────
function initResizer() {
    const resizer = document.getElementById("panel-resizer");
    const editorPanel = document.getElementById("panel-editor");
    let isResizing = false;

    resizer.addEventListener("mousedown", (e) => {
        isResizing = true;
        resizer.classList.add("dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        const containerRect = document.getElementById("ide-layout").getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        const minW = 300;
        const maxW = containerRect.width - 300;
        if (newWidth >= minW && newWidth <= maxW) {
            editorPanel.style.width = newWidth + "px";
            editor.refresh();
        }
    });

    document.addEventListener("mouseup", () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove("dragging");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
    });
}


// ── Settings Modal ────────────────────────────────────────────────
function initSettings() {
    const modal = document.getElementById("modal-settings");
    document.getElementById("btn-settings").addEventListener("click", () => {
        modal.style.display = "flex";
    });
    document.getElementById("btn-close-settings").addEventListener("click", () => {
        modal.style.display = "none";
    });
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });
}


// ── Keyboard Shortcuts ────────────────────────────────────────────
function initKeyboard() {
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
            e.preventDefault();
            toggleFullscreen();
        }
    });
}


// ── Compile ───────────────────────────────────────────────────────
async function compile() {
    const source = editor.getValue().trim();
    if (!source) {
        showToast("Please write some code first!", "error");
        return;
    }

    const btn = document.getElementById("btn-compile");
    const overlay = document.getElementById("compile-overlay");
    const skipLLM = !document.getElementById("toggle-llm").checked;

    btn.classList.add("compiling");
    btn.querySelector("svg").style.display = "none";
    overlay.style.display = "flex";

    // Animate pipeline stages
    resetPipeline();
    animatePipelineStage("frontend", "Lexing & Parsing...");

    try {
        const res = await fetch(`${API}/api/compile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, skip_llm: skipLLM }),
        });

        const result = await res.json();
        compilationResult = result;

        // Update pipeline visualization
        updatePipeline(result);

        // Render results
        renderAST(result);
        renderTypeChecker(result);
        renderLLM(result);
        renderIR(result);
        renderTiming(result);

        // Update status bar
        updateStatusBar(result);

        // Switch to most relevant tab
        autoSelectTab(result);

        saveCode();

    } catch (err) {
        showToast(`Compilation failed: ${err.message}`, "error");
        resetPipeline();
    } finally {
        btn.classList.remove("compiling");
        btn.querySelector("svg").style.display = "";
        overlay.style.display = "none";
    }
}


// ── Pipeline Visualization ────────────────────────────────────────
function resetPipeline() {
    document.querySelectorAll(".pipe-stage").forEach(s => {
        s.classList.remove("active", "success", "error", "warning");
    });
}

function animatePipelineStage(stage, text) {
    const el = document.querySelector(`.pipe-stage[data-stage="${stage}"]`);
    if (el) el.classList.add("active");
    document.getElementById("spinner-stage").textContent = text;
}

function updatePipeline(result) {
    const stages = result.stages || {};

    for (const [name, data] of Object.entries(stages)) {
        const el = document.querySelector(`.pipe-stage[data-stage="${name}"]`);
        if (!el) continue;
        el.classList.remove("active");

        if (data.status === "error") {
            el.classList.add("error");
        } else if (data.status === "skipped") {
            // leave neutral
        } else if (name === "typechecker" && data.errors && data.errors.length > 0) {
            el.classList.add("error");
        } else if (name === "typechecker" && data.warnings && data.warnings.length > 0) {
            el.classList.add("warning");
        } else if (name === "llm") {
            const v = (data.analysis || {}).verdict;
            if (v === "FAIL") el.classList.add("error");
            else if (v === "WARNINGS") el.classList.add("warning");
            else el.classList.add("success");
        } else {
            el.classList.add("success");
        }
    }
}


// ── Render AST ────────────────────────────────────────────────────
function renderAST(result) {
    const container = document.getElementById("ast-view");
    const empty = document.getElementById("empty-ast");
    const badge = document.getElementById("badge-ast");
    const frontend = (result.stages || {}).frontend || {};

    if (frontend.status === "error") {
        container.style.display = "block";
        empty.style.display = "none";
        container.innerHTML = `
            <div class="type-section errors">
                <div class="type-section-header"><span class="icon">❌</span> Parse Error</div>
                <div class="type-item"><span class="bullet">•</span> ${escapeHtml(frontend.error)}</div>
                ${frontend.raw ? `<div class="type-item" style="font-size:11px;color:var(--text-muted);word-break:break-all;">${escapeHtml(frontend.raw).substring(0, 500)}</div>` : ""}
            </div>`;
        setBadge(badge, "1", "error");
        return;
    }

    if (!frontend.ast) return;

    container.style.display = "block";
    empty.style.display = "none";
    container.innerHTML = "";
    container.appendChild(buildASTNode(frontend.ast));
    setBadge(badge, "✓", "success");
}

function buildASTNode(node, depth = 0) {
    if (node === null || node === undefined) {
        const span = document.createElement("span");
        span.className = "ast-value";
        span.textContent = "null";
        return span;
    }

    if (typeof node !== "object") {
        const span = document.createElement("span");
        span.className = typeof node === "string" ? "ast-string" : "ast-value";
        span.textContent = JSON.stringify(node);
        return span;
    }

    if (Array.isArray(node)) {
        const wrapper = document.createElement("div");
        wrapper.className = "ast-node";

        const inner = document.createElement("div");
        inner.className = "ast-node-inner";

        const toggle = document.createElement("span");
        toggle.className = "ast-toggle";
        toggle.textContent = "▼";

        const label = document.createElement("span");
        label.className = "ast-prop";
        label.textContent = `Array [${node.length}]`;

        inner.appendChild(toggle);
        inner.appendChild(label);
        wrapper.appendChild(inner);

        const children = document.createElement("div");
        children.className = "ast-children";
        node.forEach((item, i) => {
            const row = document.createElement("div");
            row.className = "ast-node";
            const idx = document.createElement("span");
            idx.className = "ast-prop";
            idx.textContent = `[${i}]: `;
            idx.style.marginLeft = "4px";
            row.appendChild(idx);
            row.appendChild(buildASTNode(item, depth + 1));
            children.appendChild(row);
        });
        wrapper.appendChild(children);

        toggle.addEventListener("click", () => {
            children.classList.toggle("collapsed");
            toggle.classList.toggle("collapsed");
        });

        return wrapper;
    }

    // Object
    const wrapper = document.createElement("div");
    wrapper.className = "ast-node";

    const inner = document.createElement("div");
    inner.className = "ast-node-inner";

    const toggle = document.createElement("span");
    toggle.className = "ast-toggle";
    toggle.textContent = "▼";

    const typeSpan = document.createElement("span");
    typeSpan.className = "ast-type";
    typeSpan.textContent = node.type || "Object";

    inner.appendChild(toggle);
    inner.appendChild(typeSpan);

    // Show key properties inline
    const inlineProps = ["name", "varType", "retType", "op", "dataType", "value", "paramType"];
    for (const prop of inlineProps) {
        if (node[prop] !== undefined && typeof node[prop] !== "object") {
            const propSpan = document.createElement("span");
            propSpan.style.marginLeft = "8px";
            propSpan.innerHTML = `<span class="ast-prop">${prop}:</span> <span class="${typeof node[prop] === 'string' ? 'ast-string' : 'ast-value'}">${JSON.stringify(node[prop])}</span>`;
            inner.appendChild(propSpan);
        }
    }

    wrapper.appendChild(inner);

    const children = document.createElement("div");
    children.className = "ast-children";

    for (const [key, val] of Object.entries(node)) {
        if (inlineProps.includes(key) && typeof val !== "object") continue;
        if (key === "type") continue;

        const row = document.createElement("div");
        row.className = "ast-node";
        const keySpan = document.createElement("span");
        keySpan.className = "ast-prop";
        keySpan.textContent = `${key}: `;
        keySpan.style.marginLeft = "4px";
        row.appendChild(keySpan);
        row.appendChild(buildASTNode(val, depth + 1));
        children.appendChild(row);
    }

    if (children.children.length > 0) {
        wrapper.appendChild(children);
        toggle.addEventListener("click", () => {
            children.classList.toggle("collapsed");
            toggle.classList.toggle("collapsed");
        });
    } else {
        toggle.style.visibility = "hidden";
    }

    // Auto-collapse deep nodes
    if (depth > 3) {
        children.classList.add("collapsed");
        toggle.classList.add("collapsed");
    }

    return wrapper;
}


// ── Render Type Checker ───────────────────────────────────────────
function renderTypeChecker(result) {
    const container = document.getElementById("type-results");
    const empty = document.getElementById("empty-types");
    const badge = document.getElementById("badge-types");
    const tc = (result.stages || {}).typechecker || {};

    if (tc.status === "error") {
        container.style.display = "block";
        empty.style.display = "none";
        container.innerHTML = `
            <div class="type-section errors">
                <div class="type-section-header"><span class="icon">❌</span> Type Checker Error</div>
                <div class="type-item"><span class="bullet">•</span> ${escapeHtml(tc.error)}</div>
            </div>`;
        setBadge(badge, "!", "error");
        return;
    }

    const errors = tc.errors || [];
    const warnings = tc.warnings || [];

    if (errors.length === 0 && warnings.length === 0) {
        container.style.display = "block";
        empty.style.display = "none";
        container.innerHTML = `
            <div class="type-section success">
                <div class="type-section-header"><span class="icon">✅</span> All Checks Passed</div>
                <div class="type-item"><span class="bullet">✓</span> No type errors or warnings detected.</div>
            </div>`;
        setBadge(badge, "✓", "success");
        return;
    }

    container.style.display = "block";
    empty.style.display = "none";

    let html = "";

    if (errors.length > 0) {
        html += `<div class="type-section errors">
            <div class="type-section-header"><span class="icon">❌</span> ${errors.length} Error${errors.length > 1 ? "s" : ""}</div>
            ${errors.map(e => `<div class="type-item"><span class="bullet" style="color:var(--error)">✗</span> ${escapeHtml(e)}</div>`).join("")}
        </div>`;
    }

    if (warnings.length > 0) {
        html += `<div class="type-section warnings">
            <div class="type-section-header"><span class="icon">⚠️</span> ${warnings.length} Warning${warnings.length > 1 ? "s" : ""}</div>
            ${warnings.map(w => `<div class="type-item"><span class="bullet" style="color:var(--warning)">⚠</span> ${escapeHtml(w)}</div>`).join("")}
        </div>`;
    }

    container.innerHTML = html;

    if (errors.length > 0) setBadge(badge, errors.length, "error");
    else if (warnings.length > 0) setBadge(badge, warnings.length, "warning");
}


// ── Render LLM Analysis ──────────────────────────────────────────
function renderLLM(result) {
    const container = document.getElementById("llm-results");
    const empty = document.getElementById("empty-llm");
    const badge = document.getElementById("badge-llm");
    const llm = (result.stages || {}).llm || {};

    if (llm.status === "skipped") {
        container.style.display = "block";
        empty.style.display = "none";
        container.innerHTML = `
            <div class="llm-verdict" style="justify-content:center;gap:12px;">
                <span style="font-size:24px;opacity:0.5;">🤖</span>
                <span style="color:var(--text-muted);font-size:14px;">LLM analysis was skipped. Toggle it on and recompile.</span>
            </div>`;
        setBadge(badge, "—", "info");
        return;
    }

    if (llm.status === "error") {
        container.style.display = "block";
        empty.style.display = "none";
        container.innerHTML = `
            <div class="type-section errors">
                <div class="type-section-header"><span class="icon">❌</span> LLM Error</div>
                <div class="type-item"><span class="bullet">•</span> ${escapeHtml(llm.error)}</div>
            </div>`;
        setBadge(badge, "!", "error");
        return;
    }

    const analysis = llm.analysis || {};
    container.style.display = "block";
    empty.style.display = "none";

    const verdict = analysis.verdict || "UNKNOWN";
    const verdictClass = verdict.toLowerCase();
    const verdictIcon = { PASS: "✅", WARNINGS: "⚠️", FAIL: "❌", UNKNOWN: "❓" }[verdict] || "❓";

    let html = `
        <div class="llm-verdict">
            <div class="verdict-left">
                <span class="verdict-icon">${verdictIcon}</span>
                <div>
                    <div class="verdict-label">Overall Verdict</div>
                    <div class="verdict-value ${verdictClass}">${verdict}</div>
                </div>
            </div>
        </div>`;

    if (analysis.summary) {
        html += `<div class="llm-summary"><strong>Summary:</strong> ${escapeHtml(analysis.summary)}</div>`;
    }

    const categories = [
        { key: "semantic_errors", label: "Semantic Errors", icon: "🔴" },
        { key: "logic_warnings", label: "Logic Warnings", icon: "🟡" },
        { key: "code_quality", label: "Code Quality", icon: "🔷" },
        { key: "optimisations", label: "Optimization Hints", icon: "🟢" },
    ];

    for (const cat of categories) {
        const items = analysis[cat.key] || [];
        if (items.length === 0) continue;
        html += `
            <div class="llm-category">
                <div class="llm-cat-header"><span class="cat-icon">${cat.icon}</span> ${cat.label} (${items.length})</div>
                ${items.map(i => `<div class="llm-item">• ${escapeHtml(typeof i === "string" ? i : JSON.stringify(i))}</div>`).join("")}
            </div>`;
    }

    container.innerHTML = html;

    if (verdict === "FAIL") setBadge(badge, "FAIL", "error");
    else if (verdict === "WARNINGS") setBadge(badge, "WARN", "warning");
    else if (verdict === "PASS") setBadge(badge, "PASS", "success");
    else setBadge(badge, "?", "info");
}


// ── Render IR ─────────────────────────────────────────────────────
function renderIR(result) {
    const container = document.getElementById("ir-view");
    const empty = document.getElementById("empty-ir");
    const badge = document.getElementById("badge-ir");
    const ir = (result.stages || {}).ir || {};

    if (ir.status === "error") {
        container.style.display = "block";
        empty.style.display = "none";
        container.innerHTML = `
            <div class="type-section errors">
                <div class="type-section-header"><span class="icon">❌</span> IR Generation Error</div>
                <div class="type-item"><span class="bullet">•</span> ${escapeHtml(ir.error)}</div>
            </div>`;
        setBadge(badge, "!", "error");
        return;
    }

    const instructions = ir.instructions || [];
    if (instructions.length === 0) return;

    container.style.display = "block";
    empty.style.display = "none";

    const html = instructions.map((instr, i) => {
        const highlighted = highlightIR(instr);
        return `<div class="ir-line"><span class="ir-num">${i + 1}</span><span class="ir-instr">${highlighted}</span></div>`;
    }).join("");

    container.innerHTML = html;
    setBadge(badge, instructions.length, "info");
}

function highlightIR(line) {
    // Highlight IR keywords
    const keywords = ["DECL", "STORE", "PRINT", "RET", "JMPF", "JMP", "CALL"];
    const labels = /^(LABEL\s+\S+:|END_FUNC\s+\S+)/;
    const funcs = /^(FUNC\s+\S+\s+\S+\(.*\):)/;

    if (funcs.test(line)) {
        return `<span class="ir-func">${escapeHtml(line)}</span>`;
    }
    if (labels.test(line)) {
        return `<span class="ir-label">${escapeHtml(line)}</span>`;
    }

    let result = escapeHtml(line);
    for (const kw of keywords) {
        result = result.replace(new RegExp(`^(${kw})\\b`), `<span class="ir-keyword">$1</span>`);
    }

    // Highlight temp vars and operators
    result = result.replace(/\b(t\d+)\b/g, `<span class="ir-op">$1</span>`);

    return result;
}


// ── Render Timing ─────────────────────────────────────────────────
function renderTiming(result) {
    const container = document.getElementById("timing-view");
    const empty = document.getElementById("empty-timing");
    const timing = result.timing || {};

    if (Object.keys(timing).length === 0) return;

    container.style.display = "flex";
    empty.style.display = "none";

    const stages = [
        { key: "frontend", label: "⚡ Lexer + Parser", color: "#6366f1" },
        { key: "typechecker", label: "🔍 Type Checker", color: "#a855f7" },
        { key: "llm", label: "🤖 LLM Analysis", color: "#f59e0b" },
        { key: "ir", label: "⚙️ IR Generator", color: "#06b6d4" },
    ];

    const total = Object.values(timing).reduce((a, b) => a + b, 0);
    const maxTime = Math.max(...Object.values(timing), 0.001);

    let html = "";
    for (const stage of stages) {
        const t = timing[stage.key];
        if (t === undefined) continue;
        const pct = (t / maxTime) * 100;
        html += `
            <div class="timing-card">
                <div class="timing-header">
                    <span class="timing-name">${stage.label}</span>
                    <span class="timing-value">${(t * 1000).toFixed(1)}ms</span>
                </div>
                <div class="timing-bar-track">
                    <div class="timing-bar-fill" style="width:${pct}%;background:${stage.color}"></div>
                </div>
            </div>`;
    }

    html += `
        <div class="timing-total">
            <span class="timing-name">Total Pipeline</span>
            <span class="timing-value">${(total * 1000).toFixed(1)}ms</span>
        </div>`;

    container.innerHTML = html;

    // Animate bars in
    setTimeout(() => {
        container.querySelectorAll(".timing-bar-fill").forEach(bar => {
            bar.style.transition = "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
        });
    }, 50);
}


// ── Status Bar ────────────────────────────────────────────────────
function updateStatusBar(result) {
    const verdictEl = document.getElementById("status-verdict");
    const messageEl = document.getElementById("status-message");
    const dot = verdictEl.querySelector(".status-dot");

    const verdict = result.verdict || "UNKNOWN";
    dot.className = "status-dot " + verdict.toLowerCase();
    verdictEl.querySelector(".status-dot").nextSibling.textContent = " " + verdict;

    const total = Object.values(result.timing || {}).reduce((a, b) => a + b, 0);
    messageEl.textContent = `Compiled in ${(total * 1000).toFixed(0)}ms`;
}


// ── Auto-select Tab ───────────────────────────────────────────────
function autoSelectTab(result) {
    const tc = (result.stages || {}).typechecker || {};
    const llm = (result.stages || {}).llm || {};
    const frontend = (result.stages || {}).frontend || {};

    let targetTab = "ast";

    if (frontend.status === "error") {
        targetTab = "ast";
    } else if (tc.errors && tc.errors.length > 0) {
        targetTab = "types";
    } else if (llm.analysis && llm.analysis.verdict === "FAIL") {
        targetTab = "llm";
    } else if (llm.analysis && llm.analysis.verdict === "WARNINGS") {
        targetTab = "llm";
    }

    const tab = document.querySelector(`.tab[data-tab="${targetTab}"]`);
    if (tab) tab.click();
}


// ── Clear Output ──────────────────────────────────────────────────
function clearOutput() {
    compilationResult = null;
    resetPipeline();

    // Reset all badges
    document.querySelectorAll(".tab-badge").forEach(b => {
        b.classList.remove("show", "error", "warning", "success", "info");
    });

    // Hide results, show empty states
    ["ast", "types", "llm", "ir", "timing"].forEach(id => {
        const content = document.getElementById(`content-${id}`);
        const view = content.querySelector(`.${id === "types" ? "type" : id === "llm" ? "llm" : id}-results, .${id}-view, .ast-view, .type-results, .llm-results, .ir-view, .timing-view`);
        const empty = document.getElementById(`empty-${id}`);
        if (empty) empty.style.display = "";
    });

    document.getElementById("ast-view").style.display = "none";
    document.getElementById("type-results").style.display = "none";
    document.getElementById("llm-results").style.display = "none";
    document.getElementById("ir-view").style.display = "none";
    document.getElementById("timing-view").style.display = "none";

    document.getElementById("status-verdict").innerHTML = `<span class="status-dot"></span> Ready`;
    document.getElementById("status-message").textContent = "";

    showToast("Output cleared", "info");
}


// ── Backend Status ────────────────────────────────────────────────
async function checkStatus() {
    try {
        const res = await fetch(`${API}/api/status`);
        const data = await res.json();
        const badge = document.getElementById("backend-badge");
        const text = badge.querySelector(".badge-text");

        if (data.has_api_key) {
            badge.classList.add("connected");
            badge.classList.remove("disconnected");
            text.textContent = data.llm_backend;
        } else {
            badge.classList.add("disconnected");
            badge.classList.remove("connected");
            text.textContent = "No LLM key set";
        }

        if (!data.binary_exists) {
            showToast("⚠️ compiler_bin not found! Run 'make' to build the Flex/Bison binary.", "error");
        }
    } catch (e) {
        const badge = document.getElementById("backend-badge");
        badge.classList.add("disconnected");
        badge.querySelector(".badge-text").textContent = "Server offline";
    }
}


// ── Set API Key ───────────────────────────────────────────────────
async function setApiKey(provider) {
    const inputId = `input-${provider}-key`;
    const key = document.getElementById(inputId).value.trim();

    if (!key) {
        showToast("Please enter an API key", "error");
        return;
    }

    try {
        const res = await fetch(`${API}/api/set-key`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, key }),
        });

        const data = await res.json();
        if (data.success) {
            showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key set!`, "success");
            document.getElementById(inputId).value = "";
            checkStatus();
        } else {
            showToast(data.error || "Failed to set key", "error");
        }
    } catch (e) {
        showToast("Failed to set API key: " + e.message, "error");
    }
}


// ── Fullscreen Toggle ─────────────────────────────────────────────
function toggleFullscreen() {
    const layout = document.getElementById("ide-layout");
    const editorPanel = document.getElementById("panel-editor");
    const outputPanel = document.getElementById("panel-output");
    const resizer = document.getElementById("panel-resizer");

    if (outputPanel.style.display === "none") {
        outputPanel.style.display = "";
        resizer.style.display = "";
        editorPanel.style.width = "50%";
    } else {
        outputPanel.style.display = "none";
        resizer.style.display = "none";
        editorPanel.style.width = "100%";
    }
    editor.refresh();
}


// ── Save/Restore Code ─────────────────────────────────────────────
function saveCode() {
    try {
        localStorage.setItem("compiler-ide-code", editor.getValue());
    } catch (e) {}
}

function restoreCode() {
    try {
        const saved = localStorage.getItem("compiler-ide-code");
        if (saved) {
            editor.setValue(saved);
        }
    } catch (e) {}
}


// ── Toast Notifications ───────────────────────────────────────────
function showToast(message, type = "info") {
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(40px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}


// ── Helpers ───────────────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function setBadge(el, text, type) {
    el.textContent = text;
    el.className = `tab-badge show ${type}`;
}
