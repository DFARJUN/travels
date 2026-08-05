# מקור → קובץ עצמאי (standalone) — Sicilia 2026

מדריך איך להפוך את קובץ המקור לקובץ העצמאי ולפרסם אותו, **בלי ה־bundler המקורי** (הוא לא קיים מקומית). התהליך הונדס לאחור ואומת שהוא הפיך במדויק.

---

## שני הקבצים
- **מקור (עורכים כאן):** `Sicilia 2026 -bundle-src-.dc.html` — קובץ Design Component. התוכן במערכי `DAYS` / `BASES` / `BOOKINGS` / `HIGHLIGHTS` / `NOTES` בתחתית, וטקסטים סטטיים בתוך תבנית ה־`<x-dc>`. מפנה ל־`image-slot.js` / `route-map.js` / `support.js` חיצונית.
- **עצמאי (מיוצר, לשיתוף):** `Sicilia 2026.html` — כל הסקריפטים/גופנים/CSS מוטמעים בפנים. זה מה שמתפרסם לנטליפיי.

**לא עורכים את הקובץ העצמאי ביד.** תמיד עורכים את המקור, ואז מייצרים מחדש.

---

## איך העצמאי בנוי (הממצא המרכזי)
העצמאי מטמיע את **המסמך המלא המוטמע** כמחרוזת JSON אחת, בתוך:

```html
<script type="__bundler/template">"<!DOCTYPE html>\n<html>...</html>"</script>
```

מנוע ה־DC קורא את המחרוזת הזו בזמן ריצה ומרנדר ממנה. סכמת הקידוד (אומתה round-trip **מדויק**, בית־בבית):

```python
encoded = json.dumps(doc, ensure_ascii=False).replace("</", "<\\u002F")
```

כלומר: JSON רגיל (עברית נשארת קריאה), ובנוסף כל `</` הופך ל־`</` כדי ש־`</script>` פנימי לא יסגור את התג בטעות.

---

## למה אי אפשר פשוט להטמיע מחדש את המקור
ה־bundler עושה שני דברים שאי אפשר לשחזר בקלות:
1. **מטמיע את סקריפטי העזר** (image-slot / route-map / support) + גופנים לתוך ה־`<head>` לפי uuid.
2. **מוסיף ~6KB בתוך `<x-dc>`** (helmet + תוכן מוטמע).

לכן משאירים את **המסמך המפוענח הקיים** (שכבר מוטמע נכון) ומשנים בו רק את מה שהשתנה.

---

## שיטת השחזור (מה שהסקריפט עושה)
`regen-standalone.py` שבתיקייה:
1. שולף ומפענח (`json.loads`) את מחרוזת ה־`__bundler/template` → המסמך המוטמע.
2. **מחליף את בלוק הנתונים כולו** — `<script type="text/x-dc"> ... </script>` — בגרסה מהמקור. זה נושא את כל שינויי `DAYS`/`BASES`/`BOOKINGS`/`HIGHLIGHTS`/`NOTES`. בטוח כי אזור הנתונים מיושר בין הקבצים.
3. **מחיל עריכות כירורגיות** על טקסטים סטטיים בתבנית שאינם data-bound (כותרת ה־hero, מונה הבסיסים, כותרת+פסקת הסקירה, הפוטר). רשימת העריכות היא `TEMPLATE_EDITS` בסקריפט. כל עריכה **חייבת להתאים בדיוק פעם אחת** — אחרת הסקריפט עוצר בקול (`ABORT`) במקום להשחית את הקובץ.
4. מקודד מחדש בסכמה המאומתת ומשחזר את הקובץ.

### הרצה
```bash
cd "personal/trips/sicily-sep-2026"
python3 regen-standalone.py                 # כותב ל־Sicilia 2026.html
python3 regen-standalone.py out.html        # או ליעד אחר לבדיקה
```

### כשמוסיפים עריכה חדשה למקור
- שינוי **בתוך מערך נתונים** (`DAYS`/`BASES`/וכו') — לא צריך לגעת בסקריפט. החלפת בלוק הנתונים תופסת אותו אוטומטית.
- שינוי **בטקסט סטטי בתבנית `<x-dc>`** (מחוץ למערכים) — להוסיף זוג `(old, new)` ל־`TEMPLATE_EDITS`, אחרת השינוי לא יעבור לעצמאי.

---

## אימות אחרי ייצור (חובה)
1. לפתוח את `Sicilia 2026.html` בדפדפן ולוודא שהתוכן החדש מרונדר.
2. לוודא שכל 6 תמונות הבסיסים נטענות (הן קישור חי לוויקימדיה; `naturalWidth > 0`).
3. לוודא שתוכן ישן נעלם.

---

## פרסום לאתר החי (אותה כתובת)
האתר החי: **https://classy-custard-e9fea8.netlify.app** (site id `1efc542c-4636-486b-849b-f60edb6041f3`).
טוקן נטליפיי ב־`.env` בשורש הריפו כ־`NETLIFY_TOKEN`. כדי לשמור על אותה כתובת מפרסמים ל־site הקיים (לא יוצרים חדש):

```bash
TOKEN=$(grep '^NETLIFY_TOKEN' <repo-root>/.env | cut -d= -f2- | tr -d '" ')
SITE=1efc542c-4636-486b-849b-f60edb6041f3
W=/tmp/nldeploy; rm -rf $W; mkdir -p $W
cp "Sicilia 2026.html" $W/index.html
printf '[[headers]]\n  for = "/*"\n  [headers.values]\n    Content-Type = "text/html; charset=UTF-8"\n' > $W/netlify.toml
( cd $W && zip -j deploy.zip index.html netlify.toml >/dev/null )
curl -s -X POST "https://api.netlify.com/api/v1/sites/$SITE/deploys" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/zip" \
  --data-binary @$W/deploy.zip
```

אחרי הפרסום: `curl -sI https://classy-custard-e9fea8.netlify.app | grep content-type` → צריך `text/html; charset=UTF-8`, ולוודא שהתוכן החדש באמת עלה.

הקובץ **חייב** להיקרא `index.html` ולבוא עם ה־`netlify.toml`, אחרת נטליפיי מגיש `text/plain`.

---

## הערות
- אם יום יימצא ה־bundler המקורי — עדיף להשתמש בו על פני השיטה כאן. השיטה כאן מדויקת אבל מסתמכת על שתי הנחות: אזור הנתונים מיושר, וטקסטי `TEMPLATE_EDITS` מופיעים בדיוק פעם אחת (הסקריפט אוכף את השנייה).
- גיבוי אחרון של העצמאי לפני עריכות שמור ב־`Sicilia 2026.bundle-backup.html`.
