%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "parser.tab.h"

int line_num = 1;
%}

%option noyywrap

DIGIT       [0-9]
LETTER      [a-zA-Z_]
ID          {LETTER}({LETTER}|{DIGIT})*
INT_LIT     {DIGIT}+
FLOAT_LIT   {DIGIT}+"."{DIGIT}+
STRING_LIT  \"[^\"]*\"
COMMENT     "//"[^\n]*

%%

{COMMENT}       { /* skip line comments */ }

"int"           { return INT_KW; }
"float"         { return FLOAT_KW; }
"string"        { return STRING_KW; }
"bool"          { return BOOL_KW; }
"if"            { return IF; }
"else"          { return ELSE; }
"while"         { return WHILE; }
"for"           { return FOR; }
"return"        { return RETURN; }
"func"          { return FUNC; }
"true"          { yylval.ival = 1; return BOOL_LIT; }
"false"         { yylval.ival = 0; return BOOL_LIT; }
"print"         { return PRINT; }

{INT_LIT}       { yylval.ival = atoi(yytext); return INT_LIT; }
{FLOAT_LIT}     { yylval.fval = atof(yytext); return FLOAT_LIT; }
{STRING_LIT}    { yylval.sval = strdup(yytext); return STRING_LIT; }
{ID}            { yylval.sval = strdup(yytext); return ID; }

"=="            { return EQ; }
"!="            { return NEQ; }
"<="            { return LEQ; }
">="            { return GEQ; }
"&&"            { return AND; }
"||"            { return OR; }
"!"             { return NOT; }
"+"             { return '+'; }
"-"             { return '-'; }
"*"             { return '*'; }
"/"             { return '/'; }
"%"             { return '%'; }
"="             { return '='; }
"<"             { return '<'; }
">"             { return '>'; }
"("             { return '('; }
")"             { return ')'; }
"{"             { return '{'; }
"}"             { return '}'; }
";"             { return ';'; }
","             { return ','; }

[ \t\r]+        { /* skip whitespace */ }
"\n"            { line_num++; }

.               {
                    fprintf(stderr, "Lexer error: unknown character '%s' at line %d\n", yytext, line_num);
                    return UNKNOWN;
                }

%%
