#!/usr/bin/env python3
"""
FastAPI Backend — LLM-Powered Semantic Compiler
================================================
POST /compile  →  receives source code, runs full pipeline,
                  returns JSON with AST, type-check, LLM analysis, IR.
GET  /status   →  reports which LLM backend is active.
POST /set-key  →  set an API key at runtime.
GET  /samples  →  sample programs for the IDE.
"""

import json, os, sys, time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ── Import compiler modules ──────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compiler import (
    SymbolTable, TypeChecker, IRGenerator,
    run_frontend, llm_analyse,
)

# ── App ───────────────────────────────────────────────────────────
app = FastAPI(title="Semantic Compiler API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BINARY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compiler_bin")
if sys.platform == "win32" and not os.path.exists(BINARY):
    if os.path.exists(BINARY + ".exe"):
        BINARY = BINARY + ".exe"


# ── Models ────────────────────────────────────────────────────────
class CompileRequest(BaseModel):
    source: str
    skip_llm: bool = False

class SetKeyRequest(BaseModel):
    provider: str
    key: str


# ── POST /compile ─────────────────────────────────────────────────
@app.post("/compile")
async def compile_code(req: CompileRequest):
    if not req.source.strip():
        raise HTTPException(status_code=400, detail="Empty source code")

    result = {"source": req.source, "stages": {}, "timing": {}}

    # ── Stage 1: Flex / Bison Frontend ──
    t0 = time.time()
    try:
        ast = run_frontend(req.source, BINARY)
        result["timing"]["frontend"] = round(time.time() - t0, 3)

        if ast.get("_fe_error"):
            result["stages"]["frontend"] = {
                "status": "error",
                "error": ast.get("msg", "Unknown parser error"),
                "raw": ast.get("raw", ""),
            }
            return result

        parse_warnings = ast.pop("_parse_warnings", None)
        result["stages"]["frontend"] = {
            "status": "success",
            "ast": ast,
            "warnings": parse_warnings,
        }
    except Exception as e:
        result["stages"]["frontend"] = {"status": "error", "error": str(e)}
        result["timing"]["frontend"] = round(time.time() - t0, 3)
        return result

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
    except Exception as e:
        result["stages"]["typechecker"] = {"status": "error", "error": str(e)}
    result["timing"]["typechecker"] = round(time.time() - t0, 3)

    # ── Stage 3: LLM Semantic Analysis ──
    if not req.skip_llm:
        t0 = time.time()
        try:
            llm_result = llm_analyse(
                ast,
                result["stages"].get("typechecker", {}).get("errors", []),
                result["stages"].get("typechecker", {}).get("warnings", []),
            )
            result["stages"]["llm"] = {"status": "success", "analysis": llm_result}
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
        result["stages"]["ir"] = {"status": "success", "instructions": ir}
    except Exception as e:
        result["stages"]["ir"] = {"status": "error", "error": str(e)}
    result["timing"]["ir"] = round(time.time() - t0, 3)

    # ── Overall verdict ──
    type_errors = result["stages"].get("typechecker", {}).get("errors", [])
    llm_verdict = (
        result["stages"].get("llm", {}).get("analysis", {}).get("verdict", "UNKNOWN")
    )
    if type_errors or llm_verdict == "FAIL":
        result["verdict"] = "FAIL"
    elif llm_verdict == "WARNINGS" or result["stages"].get("typechecker", {}).get("warnings"):
        result["verdict"] = "WARNINGS"
    else:
        result["verdict"] = "PASS"

    return result


# ── GET /status ───────────────────────────────────────────────────
@app.get("/status")
async def status():
    groq = bool(os.environ.get("GROQ_API_KEY"))
    gemini = bool(os.environ.get("GEMINI_API_KEY"))
    claude = bool(os.environ.get("ANTHROPIC_API_KEY"))

    backend = "none"
    if groq:   backend = "Groq (llama-3.3-70b) — FREE"
    elif gemini: backend = "Google Gemini 1.5 Flash — FREE"
    elif claude: backend = "Anthropic Claude — PAID"

    return {
        "llm_backend": backend,
        "has_api_key": groq or gemini or claude,
        "binary_exists": os.path.exists(BINARY),
        "binary_path": BINARY,
        "keys": {"groq": groq, "gemini": gemini, "claude": claude},
    }


# ── POST /set-key ────────────────────────────────────────────────
@app.post("/set-key")
async def set_key(req: SetKeyRequest):
    key_map = {
        "GROQ": "GROQ_API_KEY",
        "GEMINI": "GEMINI_API_KEY",
        "CLAUDE": "ANTHROPIC_API_KEY",
    }
    env_key = key_map.get(req.provider.upper())
    if not env_key:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")

    if req.key.strip():
        os.environ[env_key] = req.key.strip()
    else:
        os.environ.pop(env_key, None)

    return {"success": True, "provider": req.provider}


# ── GET /samples ──────────────────────────────────────────────────
@app.get("/samples")
async def get_samples():
    test_src = ""
    try:
        with open(os.path.join(os.path.dirname(__file__), "test.src")) as f:
            test_src = f.read()
    except Exception:
        test_src = "// test.src not found"

    return {
        "hello_world": {
            "name": "Hello World",
            "description": "Simple variable and print",
            "code": "// Hello World\nint x = 42;\nprint(x);\n",
        },
        "factorial": {
            "name": "Factorial",
            "description": "Recursive factorial function",
            "code": "// Factorial function\nfunc int factorial(int n) {\n    if (n <= 1) {\n        return 1;\n    }\n    return n * factorial(n - 1);\n}\n\nprint(factorial(5));\n",
        },
        "full_test": {
            "name": "Full Test Suite",
            "description": "Complete language feature demo",
            "code": test_src,
        },
        "type_error": {
            "name": "Type Error Demo",
            "description": "Demonstrates type checking",
            "code": '// Type error demonstration\nint x = 10;\nstring name = "hello";\n\n// This should trigger a type error\nint result = x + name;\nprint(result);\n',
        },
        "control_flow": {
            "name": "Control Flow",
            "description": "If/else and while loops",
            "code": "// Control flow demo\nint i = 0;\nint sum = 0;\n\nwhile (i < 10) {\n    sum = sum + i;\n    i = i + 1;\n}\n\nif (sum > 30) {\n    print(sum);\n} else {\n    print(0);\n}\n",
        },
        "functions": {
            "name": "Functions",
            "description": "Multiple function definitions",
            "code": "// Function demo\nfunc int add(int a, int b) {\n    return a + b;\n}\n\nfunc float average(int a, int b) {\n    float sum = a + b;\n    return sum / 2;\n}\n\nint result = add(10, 20);\nprint(result);\nprint(average(10, 20));\n",
        },
    }


# ── Entry ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  Semantic Compiler API — http://localhost:8000")
    print("=" * 60 + "\n")
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
