#!/usr/bin/env python3
"""
LLM-Powered Semantic Compiler  —  Flex + Bison + Python + LLM
==============================================================
Supports two FREE LLM backends (no credit card needed):
  1. Groq   — set GROQ_API_KEY   (free tier: groq.com)
  2. Gemini — set GEMINI_API_KEY (free tier: aistudio.google.com)
  3. Claude — set ANTHROPIC_API_KEY (paid, console.anthropic.com)
"""

import json, subprocess, sys, os, textwrap
import urllib.request, urllib.error


# ── 0. LLM backend ────────────────────────────────────────────────

def call_llm(prompt, system=""):
    groq_key   = os.environ.get("GROQ_API_KEY", "")
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    claude_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if groq_key:   return _call_groq(prompt, system, groq_key)
    if gemini_key: return _call_gemini(prompt, system, gemini_key)
    if claude_key: return _call_claude(prompt, system, claude_key)
    return json.dumps({
        "semantic_errors":[], "logic_warnings":["No API key set. Set GROQ_API_KEY (free)."],
        "code_quality":[], "optimisations":[], "verdict":"WARNINGS",
        "summary":"LLM skipped — set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY."
    })

def _http(url, headers, payload, timeout=60, retries=2):
    """POST using requests lib if available, else urllib. Auto-retry on timeout."""
    body = json.dumps(payload).encode()
    # Try requests library first (handles SSL/proxies better)
    try:
        import requests as req_lib
        for attempt in range(retries):
            try:
                r = req_lib.post(url, data=body, headers=headers, timeout=timeout)
                return r.text
            except req_lib.exceptions.Timeout:
                if attempt < retries - 1:
                    print(f"       Retry {attempt+1} (timeout) …")
            except Exception as e:
                if attempt < retries - 1:
                    print(f"       Retry {attempt+1} ({e}) …")
                else:
                    return json.dumps({"_err": str(e)})
        return json.dumps({"_err": "All retries failed (requests)"})
    except ImportError:
        pass
    # Fallback to urllib
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode()
        except urllib.error.HTTPError as e:
            return json.dumps({"_err": f"HTTP {e.code}: {e.read().decode()[:200]}"})
        except Exception as e:
            if attempt < retries - 1:
                print(f"       Retry {attempt+1} ({e}) …")
            else:
                return json.dumps({"_err": str(e)})

def _call_groq(prompt, system, key):
    msgs = []
    if system: msgs.append({"role":"system","content":system})
    msgs.append({"role":"user","content":prompt})
    raw = _http("https://api.groq.com/openai/v1/chat/completions",
        {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "User-Agent": "python-requests/2.31.0",
        },
        {"model":"llama-3.3-70b-versatile","messages":msgs,"max_tokens":1500,"temperature":0.1})
    try:
        d = json.loads(raw)
        if "_err" in d: return json.dumps({"semantic_errors":[],"logic_warnings":[],"code_quality":[],"optimisations":[],"verdict":"UNKNOWN","summary":d["_err"]})
        return d["choices"][0]["message"]["content"]
    except Exception as e:
        return json.dumps({"_err":str(e)})

def _call_gemini(prompt, system, key):
    # Try models in order — free tier availability varies by region
    models = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-pro",
    ]
    full = f"{system}\n\n{prompt}" if system else prompt
    full = full[:6000]

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        raw = _http(
            url,
            {"Content-Type": "application/json"},
            {"contents": [{"parts": [{"text": full}]}],
             "generationConfig": {"maxOutputTokens": 1000, "temperature": 0.1}},
            timeout=90, retries=2,
        )
        try:
            d = json.loads(raw)
            if "_err" in d:
                err_msg = d["_err"]
                # If it's a 404 (model not found), try next model
                if "404" in err_msg:
                    continue
                # Any other error (incl. 400 bad key) — report and stop
                return json.dumps({
                    "semantic_errors": [], "logic_warnings": [], "code_quality": [],
                    "optimisations": [], "verdict": "UNKNOWN",
                    "summary": f"Gemini error ({model}): {err_msg[:200]}"
                })
            # Success
            return d["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            continue

    return json.dumps({
        "semantic_errors": [], "logic_warnings": [], "code_quality": [],
        "optimisations": [], "verdict": "UNKNOWN",
        "summary": "All Gemini models failed. Check your API key at aistudio.google.com and make sure it has Gemini API access enabled."
    })

def _call_claude(prompt, system, key):
    payload = {"model":"claude-sonnet-4-20250514","max_tokens":1500,
               "messages":[{"role":"user","content":prompt}]}
    if system: payload["system"] = system
    raw = _http("https://api.anthropic.com/v1/messages",
        {"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
        payload)
    try:
        d = json.loads(raw)
        if "_err" in d: return json.dumps({"semantic_errors":[],"logic_warnings":[],"code_quality":[],"optimisations":[],"verdict":"UNKNOWN","summary":d["_err"]})
        return d["content"][0]["text"]
    except Exception as e:
        return json.dumps({"_err":str(e)})


# ── 1. Flex/Bison front end ────────────────────────────────────────

def run_frontend(source, binary="./compiler_bin"):
    result = subprocess.run([binary], input=source, capture_output=True, text=True)
    stderr, stdout = result.stderr.strip(), result.stdout.strip()
    if not stdout:
        return {"_fe_error": True, "msg": stderr or "no output from parser"}
    try:
        ast = json.loads(stdout)
        if stderr: ast["_parse_warnings"] = stderr
        return ast
    except json.JSONDecodeError as e:
        return {"_fe_error": True, "msg": str(e), "raw": stdout}


# ── 2. Symbol table + type checker ────────────────────────────────

class SymbolTable:
    def __init__(self):
        self.scopes   = [{}]
        self.errors   = []
        self.warnings = []

    def push(self): self.scopes.append({})
    def pop(self):
        if len(self.scopes) > 1: self.scopes.pop()

    def declare(self, name, vtype, kind="var"):
        if name in self.scopes[-1]:
            self.errors.append(f"Re-declaration of '{name}' in the same scope.")
        else:
            self.scopes[-1][name] = {"type":vtype,"kind":kind,"used":False}

    def lookup(self, name):
        for scope in reversed(self.scopes):
            if name in scope:
                scope[name]["used"] = True
                return scope[name]
        return None

    def mark_unused(self):
        for scope in self.scopes:
            for name, info in scope.items():
                if not info["used"] and info["kind"] == "var":
                    self.warnings.append(f"Variable '{name}' declared but never used.")


TYPE_COMPAT = {
    ("int","int"):"int", ("float","float"):"float",
    ("int","float"):"float", ("float","int"):"float",
    ("bool","bool"):"bool", ("string","string"):"string",
}
CMP_OPS = {"==","!=","<",">","<=",">="}


class TypeChecker:
    def __init__(self, symtab):
        self.symtab   = symtab
        self.errors   = symtab.errors
        self.warnings = symtab.warnings

    def check_program(self, node):
        for s in node.get("body",[]): self.check_stmt(s)
        self.symtab.mark_unused()

    def check_stmt(self, node):
        t = node.get("type")
        if   t=="VarDecl":  self._vdecl(node)
        elif t=="Assign":   self._assign(node)
        elif t=="If":       self._if(node)
        elif t=="While":    self._while(node)
        elif t=="FuncDecl": self._func(node)
        elif t=="Return":   self.check_expr(node.get("value"))
        elif t=="Print":    self.check_expr(node.get("value"))
        elif t=="ExprStmt": self.check_expr(node.get("expr"))
        elif t=="Block":
            self.symtab.push()
            for s in node.get("stmts",[]): self.check_stmt(s)
            self.symtab.pop()

    def _vdecl(self, node):
        self.symtab.declare(node["name"], node["varType"])
        if node.get("init"):
            it = self.check_expr(node["init"])
            if it and it != node["varType"] and not (node["varType"]=="float" and it=="int"):
                self.errors.append(f"Type mismatch: cannot assign '{it}' to '{node['varType']}' var '{node['name']}'.")

    def _assign(self, node):
        info = self.symtab.lookup(node["name"])
        if not info: self.errors.append(f"Assignment to undeclared variable '{node['name']}'."); return
        rt = self.check_expr(node["value"])
        if rt and rt != info["type"] and not (info["type"]=="float" and rt=="int"):
            self.errors.append(f"Type mismatch: cannot assign '{rt}' to '{info['type']}' var '{node['name']}'.")

    def _if(self, node):
        ct = self.check_expr(node.get("cond"))
        if ct and ct != "bool": self.warnings.append(f"If condition is '{ct}', expected 'bool'.")
        self.check_stmt(node["then"])
        if node.get("else"): self.check_stmt(node["else"])

    def _while(self, node):
        ct = self.check_expr(node.get("cond"))
        if ct and ct != "bool": self.warnings.append(f"While condition is '{ct}', expected 'bool'.")
        self.check_stmt(node["body"])

    def _func(self, node):
        self.symtab.declare(node["name"], node["retType"], kind="func")
        self.symtab.push()
        for p in node.get("params",[]): self.symtab.declare(p["name"], p["paramType"])
        self.check_stmt(node["body"])
        self.symtab.pop()

    def check_expr(self, node):
        if node is None: return None
        t = node.get("type")
        if t=="Literal":    return node["dataType"]
        if t=="Identifier":
            info = self.symtab.lookup(node["name"])
            if not info: self.errors.append(f"Use of undeclared identifier '{node['name']}'."); return None
            return info["type"]
        if t=="BinOp":
            lt = self.check_expr(node.get("left"))
            rt = self.check_expr(node.get("right"))
            op = node["op"]
            if lt and rt:
                if op in CMP_OPS: return "bool"
                res = TYPE_COMPAT.get((lt,rt))
                if res is None: self.errors.append(f"Incompatible types '{lt}' and '{rt}' for op '{op}'.")
                return res
        if t=="UnaryOp":
            ot = self.check_expr(node.get("operand"))
            if node["op"]=="!" and ot and ot!="bool": self.warnings.append(f"NOT applied to non-bool '{ot}'.")
            return ot
        if t=="Call":
            for a in node.get("args",[]): self.check_expr(a)
            info = self.symtab.lookup(node["name"])
            return info["type"] if info else None
        return None


# ── 3. LLM semantic analysis ──────────────────────────────────────

SYSTEM_PROMPT = textwrap.dedent("""\
    You are an expert compiler semantic analysis engine.
    Analyse the provided AST and type-checker report. Identify:
      1. SEMANTIC ERRORS  — issues the rule-based checker missed.
      2. LOGIC WARNINGS   — code that is likely wrong (off-by-one, dead code, etc.)
      3. CODE QUALITY     — style, naming, potential runtime issues.
      4. OPTIMISATION HINTS — constant folding, loop invariants, unnecessary branches.
      5. OVERALL VERDICT  — PASS / WARNINGS / FAIL with a one-sentence summary.

    Respond ONLY with valid JSON, no extra text:
    {
      "semantic_errors":  [ "..." ],
      "logic_warnings":   [ "..." ],
      "code_quality":     [ "..." ],
      "optimisations":    [ "..." ],
      "verdict":          "PASS",
      "summary":          "..."
    }
""")

def extract_json(raw):
    raw = raw.strip()
    try: return json.loads(raw)
    except: pass
    if "```" in raw:
        for part in raw.split("```"):
            c = part.strip().lstrip("json").strip()
            try: return json.loads(c)
            except: pass
    s, e = raw.find("{"), raw.rfind("}")
    if s!=-1 and e>s:
        try: return json.loads(raw[s:e+1])
        except: pass
    return None

def llm_analyse(ast, type_errors, type_warnings):
    if os.environ.get("GROQ_API_KEY"):        backend = "Groq  (llama-3.3-70b) — FREE"
    elif os.environ.get("GEMINI_API_KEY"):    backend = "Google Gemini 1.5 Flash — FREE"
    elif os.environ.get("ANTHROPIC_API_KEY"): backend = "Anthropic Claude — PAID"
    else:                                     backend = "none — set GROQ_API_KEY for free LLM"
    print(f"       Backend : {backend}")

    prompt = f"""=== AST ===\n{json.dumps(ast,indent=2)[:4000]}

=== Type-checker errors ===\n{json.dumps(type_errors)}

=== Type-checker warnings ===\n{json.dumps(type_warnings)}

Perform deep semantic analysis. Respond ONLY with the JSON object."""

    raw = call_llm(prompt, SYSTEM_PROMPT)
    result = extract_json(raw)
    if result: return result
    return {"semantic_errors":[],"logic_warnings":[],"code_quality":[],"optimisations":[],
            "verdict":"UNKNOWN","summary":f"Could not parse LLM response: {raw[:200]}"}


# ── 4. IR generator  (BUG FIXED — pass `out` list by reference) ───

class IRGenerator:
    """
    3-address IR generator.
    FIX: every method takes an explicit `out` list parameter instead of
    using self.instructions, which caused duplicate entries when Block
    nodes recursively called _stmt_list on the same shared list.
    """
    def __init__(self):
        self._tmp = 0

    def _t(self):
        self._tmp += 1
        return f"t{self._tmp}"

    def generate(self, node):
        out = []
        self._tmp = 0
        self._stmts(node.get("body",[]), out)
        return out

    def _stmts(self, stmts, out):
        for s in stmts: self._stmt(s, out)

    def _stmt(self, node, out):
        t = node.get("type")

        if t == "VarDecl":
            out.append(f"DECL {node['varType']} {node['name']}")
            if node.get("init"):
                v = self._expr(node["init"], out)
                out.append(f"STORE {node['name']} = {v}")

        elif t == "Assign":
            v = self._expr(node["value"], out)
            out.append(f"STORE {node['name']} = {v}")

        elif t == "Print":
            v = self._expr(node["value"], out)
            out.append(f"PRINT {v}")

        elif t == "Return":
            v = self._expr(node["value"], out) if node.get("value") else "void"
            out.append(f"RET {v}")

        elif t == "If":
            cond     = self._expr(node["cond"], out)
            lbl_else = f"L_else_{self._t()}"
            lbl_end  = f"L_end_{self._t()}"
            out.append(f"JMPF {cond} {lbl_else}")
            self._stmt(node["then"], out)
            out.append(f"JMP {lbl_end}")
            out.append(f"LABEL {lbl_else}:")
            if node.get("else"): self._stmt(node["else"], out)
            out.append(f"LABEL {lbl_end}:")

        elif t == "While":
            ls = f"L_while_{self._t()}"
            le = f"L_wend_{self._t()}"
            out.append(f"LABEL {ls}:")
            cond = self._expr(node["cond"], out)
            out.append(f"JMPF {cond} {le}")
            self._stmt(node["body"], out)
            out.append(f"JMP {ls}")
            out.append(f"LABEL {le}:")

        elif t == "FuncDecl":
            params = ", ".join(f"{p['paramType']} {p['name']}" for p in node.get("params",[]))
            out.append(f"FUNC {node['retType']} {node['name']}({params}):")
            self._stmt(node["body"], out)
            out.append(f"END_FUNC {node['name']}")

        elif t == "Block":
            self._stmts(node.get("stmts",[]), out)   # same `out`, no duplication

        elif t == "ExprStmt":
            self._expr(node.get("expr"), out)

    def _expr(self, node, out):
        if node is None: return "null"
        t = node.get("type")
        if t == "Literal":    return str(node["value"])
        if t == "Identifier": return node["name"]
        if t == "BinOp":
            l = self._expr(node["left"],  out)
            r = self._expr(node["right"], out)
            tmp = self._t()
            out.append(f"{tmp} = {l} {node['op']} {r}")
            return tmp
        if t == "UnaryOp":
            op  = self._expr(node["operand"], out)
            tmp = self._t()
            out.append(f"{tmp} = {node['op']}{op}")
            return tmp
        if t == "Call":
            args = [self._expr(a, out) for a in node.get("args",[])]
            tmp  = self._t()
            out.append(f"{tmp} = CALL {node['name']}({', '.join(args)})")
            return tmp
        return "?"


# ── 5. Report ─────────────────────────────────────────────────────

def print_report(type_errors, type_warnings, llm_result, ir_code, source):
    w, bar = 64, "─"*64

    def section(title, _w=w):
        print(f"\n┌{bar}┐\n│  {title:<{_w-2}}│\n└{bar}┘")

    section("📄  SOURCE CODE")
    for i, line in enumerate(source.splitlines(), 1):
        print(f"  {i:3}│ {line}")

    section("🔍  RULE-BASED TYPE CHECKER")
    if type_errors:
        print("  Errors:")
        for e in type_errors: print(f"    ✗ {e}")
    else:
        print("  No type errors detected.")
    if type_warnings:
        print("  Warnings:")
        for w in type_warnings: print(f"    ⚠ {w}")

    section("🤖  LLM SEMANTIC ANALYSIS")
    verdict = llm_result.get("verdict","?")
    icon    = {"PASS":"✅","WARNINGS":"⚠️ ","FAIL":"❌"}.get(verdict,"❓")
    print(f"  Verdict : {icon}  {verdict}")
    print(f"  Summary : {llm_result.get('summary','')}")
    for cat, label in [("semantic_errors","Semantic errors"),("logic_warnings","Logic warnings"),
                       ("code_quality","Code quality"),("optimisations","Optimisation hints")]:
        items = llm_result.get(cat,[])
        if items:
            print(f"\n  {label}:")
            for item in items: print(f"    • {item}")

    section("⚙️   GENERATED IR")
    for instr in ir_code:
        indent = "  " if instr.startswith(("FUNC","END_FUNC","LABEL")) else "    "
        print(f"{indent}{instr}")
    print(f"\n{'═'*64}\n")


# ── 6. Main ───────────────────────────────────────────────────────

def main():
    binary   = "./compiler_bin"
    src_file = sys.argv[1] if len(sys.argv)>1 else "test.src"

    print(f"\n{'═'*66}")
    print("  LLM-Powered Semantic Compiler  │  Flex + Bison + Python + LLM")
    print(f"{'═'*66}")

    try:
        with open(src_file) as f: source = f.read()
    except FileNotFoundError:
        print(f"[error] Source file '{src_file}' not found."); sys.exit(1)

    print(f"\n[1/4] Running Flex/Bison front end on '{src_file}' …")
    ast = run_frontend(source, binary)
    if ast.get("_fe_error"):
        print(f"  ✗ Front-end error: {ast.get('msg')}"); sys.exit(1)
    if ast.get("_parse_warnings"):
        print(f"  ⚠ Parser: {ast['_parse_warnings']}")

    print("[2/4] Running rule-based type checker …")
    symtab  = SymbolTable()
    checker = TypeChecker(symtab)
    checker.check_program(ast)

    print("[3/4] Running LLM semantic analysis …")
    llm_result = llm_analyse(ast, symtab.errors, symtab.warnings)

    print("[4/4] Generating intermediate representation …")
    ir = IRGenerator().generate(ast)

    print_report(symtab.errors, symtab.warnings, llm_result, ir, source)
    sys.exit(1 if (symtab.errors or llm_result.get("verdict")=="FAIL") else 0)

if __name__ == "__main__":
    main()