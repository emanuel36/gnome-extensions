#!/bin/sh
POFILES=$(find po -name "*.po")
for i in $POFILES; do
    LANG=$(echo $i | sed -n 's:po/\([A-Za-z_]\+\)\.po:\1:p')
    mkdir -p ${LANG}/LC_MESSAGES/
	msgfmt po/${LANG}.po -o ${LANG}/LC_MESSAGES/todotxt.mo
done
