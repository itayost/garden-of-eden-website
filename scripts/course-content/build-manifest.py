#!/usr/bin/env python3
"""Build course-manifest.json from the consolidated eden-course tree."""
import json
import os
import re
import subprocess

ROOT = os.path.expanduser("~/Downloads/eden-course")

# Chapter titles: chapter 3 is known from its source filenames.
# The rest need Eden to name them - placeholders flagged with needs_title.
CHAPTERS = [
    ("00-intro", "פתיח", None, True),
    ("01-chapter-1", "פרק 1", None, True),
    ("02-chapter-2", "פרק 2", None, True),
    ("03-nutrition-mentality", "תזונה ומנטליות", "פרק 3", False),
    ("04-chapter-4", "פרק 4", None, True),
    ("99-outro", "סיום", None, True),
]

# Hebrew lesson titles, keyed by filename. Chapter 3 titles come from the
# source filenames; numbered lessons need Eden's titles.
TITLES = {
    "00-intro.mp4": "פתיח",
    "99-outro.mp4": "סיום",
    "00-opening.mp4": "פתיחה",
    "99-summary.mp4": "סיכום",
    "01-what-we-cover.mp4": "על מה נדבר",
    "02-the-difference.mp4": "מה ההבדל",
    "03-nutrition-and-mentality.mp4": "תזונה ומנטליות",
    "04-energy-management.mp4": "ניהול אנרגיה",
    "05-morning.mp4": "בוקר",
    "06-at-school.mp4": "בזמן בית ספר",
    "07-training-at-5.mp4": "אימון ב-5",
    "08-training-at-8.mp4": "אימון ב-8",
    "09-night.mp4": "לילה",
    "10-shabbat.mp4": "שבת",
    "11-what-to-avoid.mp4": "מה אסור",
    "12-diets.mp4": "דיאטות",
    "13-supplements.mp4": "תוספים",
}


def placeholder_title(fname):
    """Hebrew placeholder for a lesson that arrived numbered, not named.

    The number comes from the slug rather than the loop index: chapters that
    open with a 00-opening file would otherwise shift every lesson number by
    one, and chapters without one would start at zero.
    """
    match = re.match(r"^\d+-lesson-(\d+)\.mp4$", fname)
    return f"שיעור {match.group(1)}" if match else "שיעור"


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    )
    return round(float(out.stdout.strip()))


chapters = []
for idx, (folder, title_he, subtitle_he, needs_title) in enumerate(CHAPTERS):
    d = os.path.join(ROOT, folder)
    lessons = []
    # Number the videos, not the directory entries: enumerating the raw listing
    # let a stray .DS_Store consume order_index 0 and shift the whole chapter.
    for order, fname in enumerate(
        f for f in sorted(os.listdir(d)) if f.endswith(".mp4")
    ):
        path = os.path.join(d, fname)
        # A lesson keeps its own placeholder flag: chapter 3's named files are
        # titled, the generic "lesson-N" files are not.
        generic = fname not in TITLES
        lessons.append({
            "order_index": order,
            "slug": fname[:-4],
            "title_he": TITLES.get(fname, placeholder_title(fname)),
            "needs_title": generic,
            "duration_sec": probe(path),
            "size_bytes": os.path.getsize(path),
            "file": os.path.join(folder, fname),
        })
    chapters.append({
        "order_index": idx,
        "slug": folder,
        "title_he": title_he,
        "subtitle_he": subtitle_he,
        "needs_title": needs_title,
        "lesson_count": len(lessons),
        "duration_sec": sum(x["duration_sec"] for x in lessons),
        "lessons": lessons,
    })

manifest = {
    "course_slug": "eden-player-development",
    "title_he": "קורס דיגיטלי",
    "needs_title": True,
    "chapter_count": len(chapters),
    "lesson_count": sum(c["lesson_count"] for c in chapters),
    "duration_sec": sum(c["duration_sec"] for c in chapters),
    "total_bytes": sum(l["size_bytes"] for c in chapters for l in c["lessons"]),
    "chapters": chapters,
}

with open(os.path.join(ROOT, "course-manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"{manifest['chapter_count']} chapters, {manifest['lesson_count']} lessons, "
      f"{manifest['duration_sec'] // 60}m {manifest['duration_sec'] % 60}s, "
      f"{manifest['total_bytes'] / 1024**3:.2f} GB")
for c in chapters:
    flag = "  [needs title]" if c["needs_title"] else ""
    print(f"  {c['slug']:<26} {c['lesson_count']:>2} lessons  "
          f"{c['duration_sec'] // 60:>3}m{c['duration_sec'] % 60:02d}s  {c['title_he']}{flag}")
