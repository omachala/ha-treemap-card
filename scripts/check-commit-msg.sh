#!/bin/sh
# Silently strip AI co-author and attribution lines from commit messages.
MSG_FILE="$1"

perl -i -ne '
  next if /^Co-Authored-By:/i;
  next if /^Co-Author:/i;
  next if /^Generated with \[Claude/;
  next if /^via \[Happy\]/;
  print;
' "$MSG_FILE"

# Remove trailing blank lines
perl -i -0pe 's/\n+$/\n/' "$MSG_FILE"
