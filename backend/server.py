#!/usr/bin/env python3
"""
Web IDE Server — Flask backend for the LLM-Powered Semantic Compiler
=====================================================================
Wraps compiler.py stages into REST API endpoints for the browser IDE.
"""

import json, os, sys, time, subprocess, traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── Import compiler modules ──────────────────────────────────────
# Add parent dir so we can import compiler.py components
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compiler import (
    SymbolTable, TypeChecker, IRGenerator,
    run_frontend, llm_analyse, extract_json, call_llm, SYSTEM_PROMPT
)

app = Flask(__name__, static_folder="web", static_url_path="")
CORS(app)

BINARY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compiler_bin")
if sys.platform == "win32" and not BINARY.endswith(".exe"):
    # On Windows, try with .exe extension if the plain binary doesn't exist
    if not os.path.exists(BINARY) and os.path.exists(BINARY + ".exe"):
        BINARY = BINARY + ".exe"


# ── Serve the IDE ─────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("web", "index.html")


# ── API: Full compilation pipeline ───────────────────────────────

@app.route("/api/compile", methods=["POST"])
def compile_code():
    data = request.get_json()
    source = data.get("source", "")
    skip_llm = data.get("skip_llm", False)

    if not source.strip():
        return jsonify({"error": "Empty source code"}), 400

    result = {
        "source": source,
        "stages": {},
        "timing": {},
    }

    # ── Stage 1: Flex/Bison Frontend ──
    t0 = time.time()
    try:
        ast = run_frontend(source, BINARY)
        result["timing"]["frontend"] = round(time.time() - t0, 3)

        if ast.get("_fe_error"):
            result["stages"]["frontend"] = {
                "status": "error",
                "error": ast.get("msg", "Unknown parser error"),
                "raw": ast.get("raw", ""),
            }
            return jsonify(result)

        parse_warnings = ast.pop("_parse_warnings", None)
        result["stages"]["frontend"] = {
            "status": "success",
            "ast": ast,
            "warnings": parse_warnings,
        }
    except Exception as e:
        result["stages"]["frontend"] = {"status": "error", "error": str(e)}
        result["timing"]["frontend"] = round(time.time() - t0, 3)
        return jsonify(result)

    # ── Stage 2: Type Checker ──
    t0 = time.time()
    try:
        symtab = SymbolTable()
        checker = TypeChecker(symtab)
        checker.check_program(ast)

        result["stages"]["typechecker"] = {
            "status": "success",
            "errors": symtab.errors,
            "warnings": symtab.warnings,
        }
        result["timing"]["typechecker"] = round(time.time() - t0, 3)
    except Exception as e:
        result["stages"]["typechecker"] = {"status": "error", "error": str(e)}
        result["timing"]["typechecker"] = round(time.time() - t0, 3)

    # ── Stage 3: LLM Semantic Analysis ──
    if not skip_llm:
        t0 = time.time()
        try:
            llm_result = llm_analyse(
                ast,
                result["stages"].get("typechecker", {}).get("errors", []),
                result["stages"].get("typechecker", {}).get("warnings", []),
            )
            result["stages"]["llm"] = {
                "status": "success",
                "analysis": llm_result,
            }
        except Exception as e:
            result["stages"]["llm"] = {"status": "error", "error": str(e)}
        result["timing"]["llm"] = round(time.time() - t0, 3)
    else:
        result["stages"]["llm"] = {"status": "skipped"}
        result["timing"]["llm"] = 0

    # ── Stage 4: IR Generation ──
    t0 = time.time()
    try:
        ir = IRGenerator().generate(ast)
        result["stages"]["ir"] = {
            "status": "success",
            "instructions": ir,
        }
    except Exception as e:
        result["stages"]["ir"] = {"status": "error", "error": str(e)}
    result["timing"]["ir"] = round(time.time() - t0, 3)

    # ── Overall verdict ──
    type_errors = result["stages"].get("typechecker", {}).get("errors", [])
    llm_verdict = (
        result["stages"]
        .get("llm", {})
        .get("analysis", {})
        .get("verdict", "UNKNOWN")
    )
    if type_errors or llm_verdict == "FAIL":
        result["verdict"] = "FAIL"
    elif llm_verdict == "WARNINGS" or result["stages"].get("typechecker", {}).get("warnings"):
        result["verdict"] = "WARNINGS"
    else:
        result["verdict"] = "PASS"

    return jsonify(result)


# ── API: Check LLM backend status ────────────────────────────────

@app.route("/api/status", methods=["GET"])
def status():
    groq = bool(os.environ.get("GROQ_API_KEY"))
    gemini = bool(os.environ.get("GEMINI_API_KEY"))
    claude = bool(os.environ.get("ANTHROPIC_API_KEY"))
    backend = "none"
    if groq: backend = "Groq (llama-3.3-70b) — FREE"
    elif gemini: backend = "Google Gemini 1.5 Flash — FREE"
    elif claude: backend = "Anthropic Claude — PAID"

    binary_exists = os.path.exists(BINARY)

    return jsonify({
        "llm_backend": backend,
        "has_api_key": groq or gemini or claude,
        "binary_exists": binary_exists,
        "binary_path": BINARY,
        "keys": {
            "groq": groq,
            "gemini": gemini,
            "claude": claude,
        }
    })


# ── API: Set API key at runtime ──────────────────────────────────

@app.route("/api/set-key", methods=["POST"])
def set_key():
    data = request.get_json()
    provider = data.get("provider", "").upper()
    key = data.get("key", "").strip()

    key_map = {
        "GROQ": "GROQ_API_KEY",
        "GEMINI": "GEMINI_API_KEY",
        "CLAUDE": "ANTHROPIC_API_KEY",
    }

    env_key = key_map.get(provider)
    if not env_key:
        return jsonify({"error": f"Unknown provider: {provider}"}), 400

    if key:
        os.environ[env_key] = key
    else:
        os.environ.pop(env_key, None)

    return jsonify({"success": True, "provider": provider})


# ── API: Load sample program ─────────────────────────────────────

@app.route("/api/samples", methods=["GET"])
def get_samples():
    samples = {
        "hello_world": {
            "name": "Hello World",
            "description": "Simple print statement",
            "code": '// Hello World\nint x = 42;\nprint(x);\n'
        },
        "factorial": {
            "name": "Factorial",
            "description": "Recursive factorial function",
            "code": '// Factorial function\nfunc int factorial(int n) {\n    if (n <= 1) {\n        return 1;\n    }\n    return n * factorial(n - 1);\n}\n\nprint(factorial(5));\n'
        },
        "full_test": {
            "name": "Full Test Suite",
            "description": "Complete language feature demo",
            "code": open(os.path.join(os.path.dirname(__file__), "test.src")).read()
        },
        "type_error": {
            "name": "Type Error Demo",
            "description": "Demonstrates type checking",
            "code": '// Type error demonstration\nint x = 10;\nstring name = "hello";\n\n// This should trigger a type error\nint result = x + name;\nprint(result);\n'
        },
        "control_flow": {
            "name": "Control Flow",
            "description": "If/else and while loops",
            "code": '// Control flow demo\nint i = 0;\nint sum = 0;\n\nwhile (i < 10) {\n    sum = sum + i;\n    i = i + 1;\n}\n\nif (sum > 30) {\n    print(sum);\n} else {\n    print(0);\n}\n'
        },
        "functions": {
            "name": "Functions",
            "description": "Multiple function definitions",
            "code": '// Function demo\nfunc int add(int a, int b) {\n    return a + b;\n}\n\nfunc float average(int a, int b) {\n    float sum = a + b;\n    return sum / 2;\n}\n\nint result = add(10, 20);\nprint(result);\nprint(average(10, 20));\n'
        }
    }
    return jsonify(samples)


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  LLM Compiler IDE — http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
