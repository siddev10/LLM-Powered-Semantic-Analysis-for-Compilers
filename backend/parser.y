%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

extern int yylex(void);
extern int line_num;
void yyerror(const char *s);

/* We accumulate JSON fragments as heap strings (char*). */
static char *jnode(const char *type, const char *body) {
    char *buf = malloc(2048);
    snprintf(buf, 2048, "{\"type\":\"%s\",%s}", type, body);
    return buf;
}
static char *jstr(const char *key, const char *val) {
    char *buf = malloc(512);
    snprintf(buf, 512, "\"%s\":\"%s\"", key, val);
    return buf;
}
static char *jint(const char *key, int val) {
    char *buf = malloc(64);
    snprintf(buf, 64, "\"%s\":%d", key, val);
    return buf;
}
static char *concat(const char *a, const char *sep, const char *b) {
    char *buf = malloc(strlen(a)+strlen(sep)+strlen(b)+4);
    sprintf(buf, "%s%s%s", a, sep, b);
    return buf;
}
static char *arr(const char *items) {
    char *buf = malloc(strlen(items)+4);
    sprintf(buf, "[%s]", items);
    return buf;
}
%}

%union {
    int    ival;
    float  fval;
    char  *sval;
}

/* Keywords */
%token INT_KW FLOAT_KW STRING_KW BOOL_KW
%token IF ELSE WHILE FOR RETURN FUNC PRINT
%token <ival> INT_LIT BOOL_LIT
%token <fval> FLOAT_LIT
%token <sval> STRING_LIT ID
%token EQ NEQ LEQ GEQ AND OR NOT UNKNOWN

%type <sval> program stmt_list stmt
%type <sval> decl_stmt assign_stmt if_stmt while_stmt for_stmt
%type <sval> return_stmt print_stmt func_decl
%type <sval> expr cmp_expr add_expr mul_expr unary_expr primary
%type <sval> type param_list param arg_list block

%left OR
%left AND
%left EQ NEQ
%left '<' '>' LEQ GEQ
%left '+' '-'
%left '*' '/' '%'
%right NOT UMINUS

%%

program:
    stmt_list   {
        char *doc = malloc(strlen($1) + 64);
        sprintf(doc, "{\"type\":\"Program\",\"body\":[%s]}", $1);
        printf("%s\n", doc);
        free(doc); free($1);
    }
;

stmt_list:
    /* empty */     { $$ = strdup(""); }
  | stmt_list stmt  {
        if (strlen($1) == 0) $$ = $2;
        else { $$ = concat($1, ",", $2); free($1); free($2); }
    }
;

stmt:
    decl_stmt    { $$ = $1; }
  | assign_stmt  { $$ = $1; }
  | if_stmt      { $$ = $1; }
  | while_stmt   { $$ = $1; }
  | for_stmt     { $$ = $1; }
  | return_stmt  { $$ = $1; }
  | print_stmt   { $$ = $1; }
  | func_decl    { $$ = $1; }
  | expr ';'     {
        char body[1024]; snprintf(body, sizeof(body), "\"expr\":%s", $1);
        $$ = jnode("ExprStmt", body); free($1);
    }
;

/* ── Declarations ─────────────────────────────────────────────── */
decl_stmt:
    type ID ';' {
        char body[256]; snprintf(body, sizeof(body), "\"varType\":\"%s\",\"name\":\"%s\"", $1, $2);
        $$ = jnode("VarDecl", body); free($1); free($2);
    }
  | type ID '=' expr ';' {
        char body[1024]; snprintf(body, sizeof(body), "\"varType\":\"%s\",\"name\":\"%s\",\"init\":%s", $1, $2, $4);
        $$ = jnode("VarDecl", body); free($1); free($2); free($4);
    }
;

assign_stmt:
    ID '=' expr ';' {
        char body[1024]; snprintf(body, sizeof(body), "\"name\":\"%s\",\"value\":%s", $1, $3);
        $$ = jnode("Assign", body); free($1); free($3);
    }
;

type:
    INT_KW    { $$ = strdup("int"); }
  | FLOAT_KW  { $$ = strdup("float"); }
  | STRING_KW { $$ = strdup("string"); }
  | BOOL_KW   { $$ = strdup("bool"); }
;

/* ── Control flow ─────────────────────────────────────────────── */
if_stmt:
    IF '(' expr ')' block {
        char body[2048]; snprintf(body, sizeof(body), "\"cond\":%s,\"then\":%s", $3, $5);
        $$ = jnode("If", body); free($3); free($5);
    }
  | IF '(' expr ')' block ELSE block {
        char body[2048]; snprintf(body, sizeof(body), "\"cond\":%s,\"then\":%s,\"else\":%s", $3, $5, $7);
        $$ = jnode("If", body); free($3); free($5); free($7);
    }
;

while_stmt:
    WHILE '(' expr ')' block {
        char body[2048]; snprintf(body, sizeof(body), "\"cond\":%s,\"body\":%s", $3, $5);
        $$ = jnode("While", body); free($3); free($5);
    }
;

for_stmt:
    FOR '(' decl_stmt expr ';' assign_stmt ')' block {
        char body[3072];
        /* strip trailing ';' already consumed by sub-rules */
        snprintf(body, sizeof(body),
            "\"init\":%s,\"cond\":%s,\"update\":%s,\"body\":%s",
            $3, $4, $6, $8);
        $$ = jnode("For", body);
        free($3); free($4); free($6); free($8);
    }
;

return_stmt:
    RETURN expr ';' {
        char body[1024]; snprintf(body, sizeof(body), "\"value\":%s", $2);
        $$ = jnode("Return", body); free($2);
    }
  | RETURN ';' {
        $$ = jnode("Return", "\"value\":null");
    }
;

print_stmt:
    PRINT '(' expr ')' ';' {
        char body[1024]; snprintf(body, sizeof(body), "\"value\":%s", $3);
        $$ = jnode("Print", body); free($3);
    }
;

/* ── Functions ────────────────────────────────────────────────── */
func_decl:
    FUNC type ID '(' param_list ')' block {
        char body[4096];
        snprintf(body, sizeof(body),
            "\"retType\":\"%s\",\"name\":\"%s\",\"params\":[%s],\"body\":%s",
            $2, $3, $5, $7);
        $$ = jnode("FuncDecl", body);
        free($2); free($3); free($5); free($7);
    }
;

param_list:
    /* empty */              { $$ = strdup(""); }
  | param                   { $$ = $1; }
  | param_list ',' param    {
        $$ = concat($1, ",", $3); free($1); free($3);
    }
;

param:
    type ID {
        char buf[256]; snprintf(buf, sizeof(buf), "{\"paramType\":\"%s\",\"name\":\"%s\"}", $1, $2);
        $$ = strdup(buf); free($1); free($2);
    }
;

block:
    '{' stmt_list '}' {
        char body[4096]; snprintf(body, sizeof(body), "\"stmts\":[%s]", $2);
        $$ = jnode("Block", body); free($2);
    }
;

/* ── Expressions ──────────────────────────────────────────────── */
expr:
    expr OR cmp_expr  {
        char b[2048]; snprintf(b, sizeof(b), "\"op\":\"||\" ,\"left\":%s,\"right\":%s", $1, $3);
        $$ = jnode("BinOp", b); free($1); free($3);
    }
  | expr AND cmp_expr {
        char b[2048]; snprintf(b, sizeof(b), "\"op\":\"&&\",\"left\":%s,\"right\":%s", $1, $3);
        $$ = jnode("BinOp", b); free($1); free($3);
    }
  | cmp_expr { $$ = $1; }
;

cmp_expr:
    cmp_expr EQ  add_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"==\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | cmp_expr NEQ add_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"!=\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | cmp_expr '<'  add_expr{ char b[2048]; snprintf(b,sizeof(b),"\"op\":\"<\" ,\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | cmp_expr '>'  add_expr{ char b[2048]; snprintf(b,sizeof(b),"\"op\":\">\" ,\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | cmp_expr LEQ add_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"<=\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | cmp_expr GEQ add_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\">=\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | add_expr { $$ = $1; }
;

add_expr:
    add_expr '+' mul_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"+\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | add_expr '-' mul_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"-\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | mul_expr { $$ = $1; }
;

mul_expr:
    mul_expr '*' unary_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"*\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | mul_expr '/' unary_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"/\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | mul_expr '%' unary_expr { char b[2048]; snprintf(b,sizeof(b),"\"op\":\"%%\",\"left\":%s,\"right\":%s",$1,$3); $$=jnode("BinOp",b);free($1);free($3); }
  | unary_expr { $$ = $1; }
;

unary_expr:
    NOT unary_expr  { char b[512]; snprintf(b,sizeof(b),"\"op\":\"!\",\"operand\":%s",$2); $$=jnode("UnaryOp",b); free($2); }
  | '-' unary_expr %prec UMINUS { char b[512]; snprintf(b,sizeof(b),"\"op\":\"-\",\"operand\":%s",$2); $$=jnode("UnaryOp",b); free($2); }
  | primary { $$ = $1; }
;

primary:
    INT_LIT     { char b[64];  snprintf(b,sizeof(b),"\"dataType\":\"int\",\"value\":%d",$1);  $$=jnode("Literal",b); }
  | FLOAT_LIT   { char b[64];  snprintf(b,sizeof(b),"\"dataType\":\"float\",\"value\":%g",$1);$$=jnode("Literal",b); }
  | BOOL_LIT    { char b[64];  snprintf(b,sizeof(b),"\"dataType\":\"bool\",\"value\":%d",$1); $$=jnode("Literal",b); }
  | STRING_LIT  { char b[512]; snprintf(b,sizeof(b),"\"dataType\":\"string\",\"value\":%s",$1);$$=jnode("Literal",b);free($1); }
  | ID          {
        char b[256]; snprintf(b,sizeof(b),"\"name\":\"%s\"",$1);
        $$=jnode("Identifier",b); free($1);
    }
  | ID '(' arg_list ')' {
        char b[2048]; snprintf(b,sizeof(b),"\"name\":\"%s\",\"args\":[%s]",$1,$3);
        $$=jnode("Call",b); free($1); free($3);
    }
  | '(' expr ')' { $$ = $2; }
;

arg_list:
    /* empty */          { $$ = strdup(""); }
  | expr                 { $$ = $1; }
  | arg_list ',' expr   { $$ = concat($1,",",$3); free($1); free($3); }
;

%%

void yyerror(const char *s) {
    fprintf(stderr, "{\"error\":\"ParseError\",\"msg\":\"%s\",\"line\":%d}\n", s, line_num);
}

int main(void) {
    return yyparse();
}
