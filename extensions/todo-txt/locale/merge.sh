#!/bin/sh
find po -name "*.po" -exec msgmerge -U {} messages.pot \;
