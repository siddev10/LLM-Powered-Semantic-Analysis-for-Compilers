CC      = gcc
CFLAGS  = -Wall -Wno-unused-function
BINARY  = compiler_bin

.PHONY: all clean run

all: $(BINARY)

parser.tab.c parser.tab.h: parser.y
	bison -d parser.y

lex.yy.c: lexer.l parser.tab.h
	flex lexer.l

$(BINARY): lex.yy.c parser.tab.c
	$(CC) $(CFLAGS) -o $(BINARY) lex.yy.c parser.tab.c

run: $(BINARY)
	python3 compiler.py test.src

clean:
	rm -f $(BINARY) lex.yy.c parser.tab.c parser.tab.h *.o
