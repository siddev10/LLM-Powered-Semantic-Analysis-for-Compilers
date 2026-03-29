# LLM-Powered Semantic Compiler
### Flex + Bison + Python + Claude (Anthropic API)

A complete compiler pipeline combining classical compiler theory (lexing, parsing,
type-checking) with LLM-powered deep semantic analysis.

## Architecture

```
Source (.src)
    ▼
[Flex Lexer] ──tokens──► [Bison Parser] ──AST (JSON)──►
                                                        [Python Orchestrator]
                                                           ├─ Symbol Table
                                                           ├─ Type Checker
                                                           ├─ Claude LLM Engine
                                                           └─ IR Generator
                                                                    ▼
                                                          Report + IR output
```

## Files

| File          | Description |
|---------------|-------------|
| `lexer.l`     | Flex rules — tokenises source into INT, FLOAT, ID, operators |
| `parser.y`    | Bison grammar — 40+ rules, emits full JSON AST |
| `compiler.py` | Python orchestrator — type checker, LLM analysis, IR generator |
| `Makefile`    | Builds the Flex/Bison C binary |
| `test.src`    | Sample source program |

## Language Features

- **Types**: `int`, `float`, `string`, `bool`
- **Declarations** with initialisation: `int x = 5;`
- **Assignment**: `x = x + 1;`
- **Arithmetic**: `+  -  *  /  %`  and unary `-`
- **Comparisons**: `==  !=  <  >  <=  >=`
- **Logic**: `&&  ||  !`
- **Control flow**: `if / else`,  `while`
- **Functions**: `func int factorial(int n) { ... }`
- **Print**: `print(expr);`
- **Comments**: `// line comments`

## Build & Run

```bash
# Prerequisites: flex, bison, gcc, python3
make                                  # compile Flex/Bison binary

export ANTHROPIC_API_KEY=sk-ant-...   # required for LLM stage
python3 compiler.py test.src          # run on sample program
python3 compiler.py my_program.src    # run on your own file
```

## Pipeline Stages

### 1 — Flex Lexer (lexer.l)
Converts raw source to a token stream. Tracks line numbers, handles
unknown characters, and distinguishes keywords from identifiers.

### 2 — Bison Parser (parser.y)
Full grammar definition. Each rule emits a JSON node; the result is a
single `{"type":"Program","body":[...]}` document written to stdout.

### 3 — Python Rule-Based Type Checker
- Scoped symbol table (push/pop on `{}` blocks)
- Re-declaration and undeclared-variable detection
- Type-compatibility checking for all binary operators
- Assignment type-mismatch detection
- Unused-variable warnings

### 4 — LLM Semantic Analysis (Claude via Anthropic API)
Sends AST + type-checker results to Claude. The model reasons about:
- Semantic errors missed by the rule-based pass
- Logic bugs (off-by-one, dead code, unreachable branches)
- Code quality (naming, style, runtime risks)
- Optimisation hints (constant folding, loop invariants)
- Overall verdict: `PASS` / `WARNINGS` / `FAIL`

The parser uses three fallback strategies to extract JSON from the
response even when Claude wraps it in markdown fences.

### 5 — IR Code Generator
Produces simple 3-address IR:
```
DECL int x
STORE x = 5
t1 = x + 3
JMPF t1 L_else_1
LABEL L_else_1:
```

## Extending the Compiler

| Goal | File |
|------|------|
| New token (e.g. `++`) | `lexer.l` |
| New statement (e.g. `break`) | `parser.y` |
| New type rule | `compiler.py` → `TYPE_COMPAT` or `TypeChecker` |
| Richer IR | `compiler.py` → `IRGenerator` |
| Custom LLM analysis rules | `compiler.py` → `SYSTEM_PROMPT` |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Compiled successfully |
| `1` | Type errors or LLM verdict = FAIL |
