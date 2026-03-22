"""
Definitive OCR BiDi verification test.

PIL without libraqm renders Hebrew chars LTR (backwards visually).
To create a PROPERLY rendered Hebrew image, we must pre-apply get_display()
so that PIL's LTR rendering produces correct visual appearance.

Then we OCR the correctly-looking image and verify the server returns
correct LOGICAL order text (without _fix_bidi mangling it).
"""
import os, io, base64, json, urllib.request, sys

OUT = r"C:\temp\ocr_verify.txt"
os.makedirs(r"C:\temp", exist_ok=True)

results = []
def log(msg):
    results.append(msg)
    print(msg)

from PIL import Image, ImageDraw, ImageFont, features
from bidi.algorithm import get_display

log(f"libraqm available: {features.check('raqm')}")

# Test phrases in LOGICAL order (correct reading order)
test_phrases = [
    "שמור וזכור בדיבור אחד",
    "בראשית ברא אלהים",
    "הלכה למשה מסיני",
]

font = ImageFont.truetype("C:/Windows/Fonts/david.ttf", 48)

# Create image with PROPERLY RENDERED Hebrew
# Since PIL without libraqm renders LTR, we pre-apply get_display to make it look correct
img = Image.new('RGB', (900, 320), 'white')
draw = ImageDraw.Draw(img)

has_libraqm = features.check('raqm')
y = 30
for phrase in test_phrases:
    if has_libraqm:
        # libraqm handles RTL natively
        draw.text((880, y), phrase, fill='black', font=font, anchor="ra", direction="rtl")
    else:
        # Without libraqm: pre-apply visual order so LTR rendering looks correct
        visual = get_display(phrase)
        bbox = draw.textbbox((0, 0), visual, font=font)
        w = bbox[2] - bbox[0]
        draw.text((880 - w, y), visual, fill='black', font=font)
    y += 90

img.save(r"C:\temp\verify_hebrew.png")
log("Created properly rendered Hebrew image")

# Send to OCR server
buf = io.BytesIO()
img.save(buf, format='PNG')
b64 = base64.b64encode(buf.getvalue()).decode()

data = json.dumps({"image": f"data:image/png;base64,{b64}", "engine": "surya"}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8399/ocr/base64',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

log("\nSending to OCR server...")
try:
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read().decode())
except Exception as e:
    log(f"ERROR: {e}")
    sys.exit(1)

log(f"Engine: {result.get('engine')}")
page = result.get('pages', [{}])[0]
ocr_lines = [l.get('text', '').strip() for l in page.get('lines', [])]

log(f"\n{'='*60}")
log(f"{'RESULTS':^60}")
log(f"{'='*60}")

all_pass = True
for i, expected in enumerate(test_phrases):
    got = ocr_lines[i] if i < len(ocr_lines) else "(missing)"
    match = got == expected
    status = "PASS" if match else "FAIL"
    if not match:
        all_pass = False
    log(f"\n[{status}] Line {i+1}:")
    log(f"  Expected: [{expected}]")
    log(f"  Got:      [{got}]")
    if not match:
        # Check if it's reversed
        reversed_got = got[::-1]
        if reversed_got == expected:
            log(f"  NOTE: Text is CHARACTER-reversed!")
        # Check if words are reversed
        words_reversed = ' '.join(got.split()[::-1])
        if words_reversed == expected:
            log(f"  NOTE: Text is WORD-reversed!")
        # Check char-by-char
        if len(got) == len(expected):
            diffs = [(j, e, g) for j, (e, g) in enumerate(zip(expected, got)) if e != g]
            if diffs:
                log(f"  Char diffs: {diffs[:10]}")

log(f"\n{'='*60}")
if all_pass:
    log("ALL TESTS PASSED - BiDi fix verified!")
    log("Surya outputs logical order, _fix_bidi correctly removed.")
else:
    log("SOME TESTS FAILED - see details above")
    # Additional diagnostics
    log("\nDiagnostics:")
    for i, got in enumerate(ocr_lines):
        display = get_display(got)
        expected = test_phrases[i] if i < len(test_phrases) else "?"
        log(f"  Line {i+1} get_display: [{display}]")
        log(f"  Matches expected? {display == expected}")

log(f"{'='*60}")

# Write results to file
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(results))
