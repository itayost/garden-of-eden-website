#!/bin/bash
# Consolidate the three partial download folders into one canonical course tree.
# Uses hardlinks: originals are untouched, no extra disk used, same volume only.
set -euo pipefail

SRC="$HOME/Downloads"
DST="$HOME/Downloads/eden-course"
A="$SRC/פרקים"
B="$SRC/פרקים 2"
C="$SRC/פרקים 3"

# link <source> <dest> -- records the pair; nothing touches disk until every
# source below has been proven to exist. Wiping $DST first was destructive on a
# re-run: the tree is only hardlinks to the originals, so once those source
# folders have been cleared out of Downloads (they are 20+ GB of video), a second
# run deleted the one remaining copy and then failed on the first MISSING.
PAIRS=()
link() {
  PAIRS+=("$1" "$2")
}

# --- intro ---
link "$B/פתיח.mp4"                    "$DST/00-intro/00-intro.mp4"

# --- chapter 1 (1.1 - 1.7 + summary) ---
link "$B/פרק 1/1.1.mp4"               "$DST/01-chapter-1/01-lesson-1.mp4"
link "$B/פרק 1/1.2.mp4"               "$DST/01-chapter-1/02-lesson-2.mp4"
link "$C/פרק 1/1.3.mp4"               "$DST/01-chapter-1/03-lesson-3.mp4"
link "$A/פרק 1/1.4.mp4"               "$DST/01-chapter-1/04-lesson-4.mp4"
link "$C/פרק 1/1.5.mp4"               "$DST/01-chapter-1/05-lesson-5.mp4"
link "$A/פרק 1/1.6.mp4"               "$DST/01-chapter-1/06-lesson-6.mp4"
link "$A/פרק 1/1.7.mp4"               "$DST/01-chapter-1/07-lesson-7.mp4"
link "$B/פרק 1/סיכום.mp4"             "$DST/01-chapter-1/99-summary.mp4"

# --- chapter 2 (opening + 2.1 - 2.7 + summary) ---
link "$B/פרק 2/פתיחה.mp4"             "$DST/02-chapter-2/00-opening.mp4"
link "$C/פרק 2/2.1.mp4"               "$DST/02-chapter-2/01-lesson-1.mp4"
link "$C/פרק 2/2.2.mp4"               "$DST/02-chapter-2/02-lesson-2.mp4"
link "$C/פרק 2/2.3.mp4"               "$DST/02-chapter-2/03-lesson-3.mp4"
link "$B/פרק 2/2.4.mp4"               "$DST/02-chapter-2/04-lesson-4.mp4"
link "$C/פרק 2/2.5.mp4"               "$DST/02-chapter-2/05-lesson-5.mp4"
link "$A/פרק 2/2.6.mp4"               "$DST/02-chapter-2/06-lesson-6.mp4"
link "$A/פרק 2/2.7.mp4"               "$DST/02-chapter-2/07-lesson-7.mp4"
link "$B/פרק 2/סיכום.mp4"             "$DST/02-chapter-2/99-summary.mp4"

# --- chapter 3: nutrition & mentality (named files, ordered by topic flow) ---
CH3="$DST/03-nutrition-mentality"
link "$B/פרק 3/דברי_פתיחה (1080p).mp4"        "$CH3/00-opening.mp4"
link "$B/פרק 3/על_מה_נדבר_v1 (1080p).mp4"     "$CH3/01-what-we-cover.mp4"
link "$B/פרק 3/מה_ההבדל_v1 (1080p).mp4"       "$CH3/02-the-difference.mp4"
link "$A/פרק 3/תזונה_ומנטליות_v1 (1080p).mp4" "$CH3/03-nutrition-and-mentality.mp4"
link "$B/פרק 3/ניהול_אנרגיה_v1 (1080p).mp4"   "$CH3/04-energy-management.mp4"
link "$B/פרק 3/בוקר_v1 (1080p).mp4"           "$CH3/05-morning.mp4"
link "$B/פרק 3/בזמן_בית_ספר_v1 (1080p).mp4"   "$CH3/06-at-school.mp4"
link "$B/פרק 3/אימון_ב5_v1 (1080p).mp4"       "$CH3/07-training-at-5.mp4"
link "$B/פרק 3/אימון_ב8_v1 (1080p).mp4"       "$CH3/08-training-at-8.mp4"
link "$B/פרק 3/לילה_v1 (1080p).mp4"           "$CH3/09-night.mp4"
link "$B/פרק 3/שבת_v1 (1080p).mp4"            "$CH3/10-shabbat.mp4"
link "$B/פרק 3/מה_אסור (1080p).mp4"           "$CH3/11-what-to-avoid.mp4"
link "$B/פרק 3/דיאטות_v1 (1080p).mp4"         "$CH3/12-diets.mp4"
link "$B/פרק 3/תוספים_v1 (1080p).mp4"         "$CH3/13-supplements.mp4"
link "$B/פרק 3/סייכום_v1 (1080p).mp4"         "$CH3/99-summary.mp4"

# --- chapter 4 (opening + 4 lessons, source names 11111/2222/333/4444) ---
link "$B/פרק 4/פתיח .mp4"             "$DST/04-chapter-4/00-opening.mp4"
link "$A/פרק 4/11111.mp4"             "$DST/04-chapter-4/01-lesson-1.mp4"
link "$A/פרק 4/2222.mp4"              "$DST/04-chapter-4/02-lesson-2.mp4"
link "$A/פרק 4/333.mp4"               "$DST/04-chapter-4/03-lesson-3.mp4"
link "$A/פרק 4/4444.mp4"              "$DST/04-chapter-4/04-lesson-4.mp4"

# --- outro ---
link "$B/סיום.mp4"                    "$DST/99-outro/99-outro.mp4"

# --- verify every source, then build ---
missing=0
for ((i = 0; i < ${#PAIRS[@]}; i += 2)); do
  if [ ! -f "${PAIRS[i]}" ]; then
    echo "MISSING: ${PAIRS[i]}" >&2
    missing=$((missing + 1))
  fi
done
if [ "$missing" -gt 0 ]; then
  echo "$missing source file(s) missing; $DST left untouched." >&2
  exit 1
fi

rm -rf "$DST"
mkdir -p "$DST"/{00-intro,01-chapter-1,02-chapter-2,03-nutrition-mentality,04-chapter-4,99-outro}

for ((i = 0; i < ${#PAIRS[@]}; i += 2)); do
  ln "${PAIRS[i]}" "${PAIRS[i + 1]}"
done

echo "Linked $(find "$DST" -name '*.mp4' | wc -l | tr -d ' ') files into $DST"
