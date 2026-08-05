#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
regen-standalone.py — Rebuild "Sicilia 2026.html" (standalone) from the current
"Sicilia 2026 -bundle-src-.dc.html" WITHOUT the original DC bundler.

How the standalone works (reverse-engineered):
  The standalone embeds the FULL inlined document as one JSON-escaped string
  inside  <script type="__bundler/template">"...."</script> .
  Encoding scheme (round-trip verified EXACT):
      encoded = json.dumps(doc, ensure_ascii=False).replace("</", "<\\u002F")
  The DC engine reads that template at runtime and renders from it.

Why we can't just re-embed the src file:
  The bundler INLINES the helper scripts (image-slot.js / route-map.js /
  support.js) + fonts into <head> by uuid, and adds ~6KB inside <x-dc>.
  So we keep the decoded (already-inlined) document and change only:
    1. the data block  <script type="text/x-dc"> ... </script>  (swapped whole
       from the src — this carries DAYS / BASES / BOOKINGS / HIGHLIGHTS / NOTES)
    2. the static template texts in <x-dc> that are NOT data-bound
       (hero tagline, stat counts, overview heading/prose, footer) — surgical.

Each surgical edit asserts it matches EXACTLY once, so a drift aborts loudly
instead of silently corrupting the shared file.

Usage:  python3 regen-standalone.py            # writes Sicilia 2026.html
        python3 regen-standalone.py out.html   # writes to a chosen path
"""
import json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
STANDALONE = os.path.join(HERE, "Sicilia 2026.html")
SRC        = os.path.join(HERE, "Sicilia 2026 -bundle-src-.dc.html")
MARKER     = '<script type="__bundler/template">'

# Static template texts changed for the Scoglitti update. Keep this list in sync
# whenever you edit non-data text inside the <x-dc> markup of the .dc.html.
TEMPLATE_EDITS = [
    # The bundler rewrote the hero <image-slot src> into a dangling "{{ heroSrc }}"
    # binding that has no backing logic, so the hero renders empty. Restore the
    # literal Wikimedia URL used by the source (line ~37 of the .dc.html).
    ('src="{{ heroSrc }}"',
     'src="https://commons.wikimedia.org/wiki/Special:FilePath/Mt%20Etna%20and%20Taormina%20as%20seen%20from%20the%20Ancient%20Theatre%20of%20Taormina%20(22290641726).jpg?width=1800"'),
    ("<span>לופ מסביב לאי · ללא כביש חוזר</span>",
     "<span>לופ מסביב לאי · סיום על החוף</span>"),
    ("<span>5 בסיסים</span>", "<span>6 בסיסים</span>"),
    ('<span>~700 ק"מ</span>', '<span>~800 ק"מ</span>'),
    ("לופ אחד נגד כיוון השעון</h2>",
     "לופ נגד כיוון השעון, סיום על החוף</h2>"),
    ("→ חזרה לקטניה. הטיסות הלוך־חזור מקטניה, הרכב נאסף ומוחזר באותו שדה תעופה, ואף קטע כביש לא חוזר על עצמו. ספטמבר",
     "→ ומשם דרומה לשני לילות חוף בסקוליטי, לפני חזרה לקטניה לטיסה. הטיסות הלוך־חזור מקטניה, והרכב נאסף ומוחזר באותו שדה תעופה. ספטמבר"),
    ("חמישה בסיסים, תשעה לילות.", "ששה בסיסים, תשעה לילות."),
    ('לופ אחד, ~700 ק"מ, ואף כביש לא חוזר על עצמו.',
     'לופ גדול, ~800 ק"מ, שנסגר בשני לילות חוף בסקוליטי לפני הטיסה.'),
]

def data_region(text):
    i = text.find('<script type="text/x-dc"')
    if i < 0:
        raise SystemExit("data script not found")
    j = text.find("</script>", i) + len("</script>")
    return text[i:j]

def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else STANDALONE
    s   = open(STANDALONE, encoding="utf-8").read()
    src = open(SRC, encoding="utf-8").read()

    i = s.find(MARKER)
    if i < 0:
        raise SystemExit("bundler template marker not found")
    st = i + len(MARKER)
    en = s.find("</script>", st)
    pre, tmpl, post = s[:st], s[st:en], s[en:]
    lead = tmpl[:len(tmpl) - len(tmpl.lstrip())]     # whitespace before the JSON string

    doc = json.loads(tmpl.strip())                   # the inlined document

    # 1) surgical static-text edits
    for old, new in TEMPLATE_EDITS:
        c = doc.count(old)
        if c != 1:
            raise SystemExit(f"ABORT: expected exactly 1 match, found {c} for:\n  {old[:60]}...")
        doc = doc.replace(old, new)

    # 2) whole data block swap
    old_data = data_region(doc)
    new_data = data_region(src)
    if doc.count(old_data) != 1:
        raise SystemExit("ABORT: data block not uniquely located in template")
    doc = doc.replace(old_data, new_data)

    # re-encode with the verified scheme and splice back
    enc = json.dumps(doc, ensure_ascii=False).replace("</", "<\\u002F")
    open(out_path, "w", encoding="utf-8").write(pre + lead + enc + post)
    print("wrote", out_path, "(", len(pre + lead + enc + post), "bytes )")

if __name__ == "__main__":
    main()
