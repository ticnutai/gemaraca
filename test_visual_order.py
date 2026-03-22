"""
Test the visual-order detection & fix.
Creates a PDF with visual-order Hebrew (simulating real Israeli legal PDFs)
and verifies the server returns correct logical-order text.
"""
import io, base64, json, urllib.request, sys

# ── Step 1: Test the detection function directly ──
print("=" * 60)
print("Step 1: Test _is_visual_order detection")
print("=" * 60)

# Sofit letters: ם ן ף ך ץ
# Visual-order text has sofit at word STARTS (because words are reversed)

# Logical order (correct): sofit at word ends
logical_lines = [
    "שמור וזכור בדיבור אחד נאמרו",
    "בראשית ברא אלהים את השמים",
    "הלכה למשה מסיני",
    "והארץ היתה תהו ובהו וחשך על פנים",
]

# Visual order (reversed): sofit at word starts
visual_lines = [line[::-1] for line in logical_lines]
# But we need word-level reversal, not full line reversal
# In visual order, each word's chars are reversed AND word order is reversed
visual_lines_proper = []
for line in logical_lines:
    # Full string reversal = reversed chars + reversed word order
    visual_lines_proper.append(line[::-1])

print("Logical lines:")
for l in logical_lines:
    print(f"  [{l}]")
    words = l.split()
    for w in words:
        clean = w.strip('.,;:!?')
        if len(clean) >= 2:
            if clean[0] in 'םןףךץ':
                print(f"    Word [{clean}] starts with sofit!")
            if clean[-1] in 'םןףךץ':
                print(f"    Word [{clean}] ends with sofit")

print("\nVisual lines (full string reversed):")
for l in visual_lines_proper:
    print(f"  [{l}]")
    words = l.split()
    for w in words:
        clean = w.strip('.,;:')
        if len(clean) >= 2:
            if clean[0] in 'םןףךץ':
                print(f"    Word [{clean}] starts with sofit!")
            if clean[-1] in 'םןףךץ':
                print(f"    Word [{clean}] ends with sofit")

# ── Step 2: Test _ensure_logical_order via the server ──
print("\n" + "=" * 60)
print("Step 2: Test born-digital PDF with visual-order text")
print("=" * 60)

from fpdf import FPDF
from bidi.algorithm import get_display

# Create a PDF that stores text in visual order
# (simulating old Hebrew PDFs)
pdf = FPDF()
pdf.add_page()
pdf.add_font("David", "", "C:/Windows/Fonts/david.ttf")
pdf.set_font("David", size=16)

test_phrases = [
    "שמור וזכור בדיבור אחד נאמרו",
    "בראשית ברא אלהים את השמים",
    "הלכה למשה מסיני",
    "והארץ היתה תהו ובהו וחשך על פנים",
    "ורוח אלהים מרחפת על פני המים",
]

# Store visual-order text in the PDF (simulating old Hebrew PDFs)
# Visual order = get_display() of logical order
for phrase in test_phrases:
    visual = get_display(phrase)  # Convert to visual order
    pdf.cell(0, 10, visual, new_x="LMARGIN", new_y="NEXT")

pdf_bytes = pdf.output()
print(f"Created visual-order PDF: {len(pdf_bytes)} bytes")

# Verify pdfplumber sees visual order
import pdfplumber
p = pdfplumber.open(io.BytesIO(pdf_bytes))
raw = p.pages[0].extract_text() or ""
print("\npdfplumber raw extraction:")
for line in raw.split("\n"):
    if line.strip():
        print(f"  [{line.strip()}]")
p.close()

# Send to server
b64 = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode()
data = json.dumps({
    "image": b64,
    "filename": "visual_order_test.pdf",
    "engine": "auto",
}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8399/ocr/base64",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
resp = urllib.request.urlopen(req, timeout=60)
result = json.loads(resp.read().decode())

engine = result.get("engine", "?")
print(f"\nServer response - Engine: {engine}")
print(f"Time: {result.get('processing_time_seconds', 0)}s")

page = result["pages"][0]
server_lines = [l["text"].strip() for l in page.get("text_lines", [])]

print(f"\n--- Results ---")
all_pass = True
for i, expected in enumerate(test_phrases):
    got = server_lines[i] if i < len(server_lines) else "(missing)"
    match = got == expected
    if not match:
        all_pass = False
    status = "PASS" if match else "FAIL"
    print(f"[{status}] Expected: [{expected}]")
    print(f"         Got:      [{got}]")

print()
if all_pass:
    print("ALL PASS! Visual-order PDF fix works!")
else:
    print("FAILED - Visual-order fix not working")

# ── Step 3: Verify logical-order PDFs still work ──
print("\n" + "=" * 60)
print("Step 3: Verify logical-order PDFs still work")
print("=" * 60)

pdf2 = FPDF()
pdf2.add_page()
pdf2.add_font("David", "", "C:/Windows/Fonts/david.ttf")
pdf2.set_font("David", size=16)

for phrase in test_phrases:
    pdf2.cell(0, 10, phrase, new_x="LMARGIN", new_y="NEXT")

pdf2_bytes = pdf2.output()

b64_2 = "data:application/pdf;base64," + base64.b64encode(pdf2_bytes).decode()
data2 = json.dumps({
    "image": b64_2,
    "filename": "logical_order_test.pdf",
    "engine": "auto",
}).encode()
req2 = urllib.request.Request(
    "http://127.0.0.1:8399/ocr/base64",
    data=data2,
    headers={"Content-Type": "application/json"},
    method="POST",
)
resp2 = urllib.request.urlopen(req2, timeout=60)
result2 = json.loads(resp2.read().decode())

print(f"Engine: {result2.get('engine', '?')}")

page2 = result2["pages"][0]
lines2 = [l["text"].strip() for l in page2.get("text_lines", [])]

all_pass2 = True
for i, expected in enumerate(test_phrases):
    got = lines2[i] if i < len(lines2) else "(missing)"
    match = got == expected
    if not match:
        all_pass2 = False
    status = "PASS" if match else "FAIL"
    print(f"[{status}] Expected: [{expected}]")
    print(f"         Got:      [{got}]")

print()
if all_pass2:
    print("ALL PASS! Logical-order PDFs still work correctly!")
else:
    print("REGRESSION - logical-order PDFs broken!")

# ── Step 4: Verify Surya OCR still works ──
print("\n" + "=" * 60)
print("Step 4: Verify Surya OCR still works")  
print("=" * 60)

from PIL import Image, ImageDraw, ImageFont

font = ImageFont.truetype("C:/Windows/Fonts/david.ttf", 48)
img = Image.new("RGB", (900, 320), "white")
draw = ImageDraw.Draw(img)

y = 30
for phrase in test_phrases[:3]:
    visual = get_display(phrase)
    bbox = draw.textbbox((0, 0), visual, font=font)
    w = bbox[2] - bbox[0]
    draw.text((880 - w, y), visual, fill="black", font=font)
    y += 90

buf = io.BytesIO()
img.save(buf, format="PNG")
b64_img = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

result3 = json.loads(urllib.request.urlopen(
    urllib.request.Request(
        "http://127.0.0.1:8399/ocr/base64",
        data=json.dumps({"image": b64_img, "engine": "surya"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    ),
    timeout=120,
).read().decode())

print(f"Engine: {result3.get('engine', '?')}")
page3 = result3["pages"][0]
lines3 = [l["text"].strip() for l in page3.get("text_lines", [])]

all_pass3 = True
for i, expected in enumerate(test_phrases[:3]):
    got = lines3[i] if i < len(lines3) else "(missing)"
    match = got == expected
    if not match:
        all_pass3 = False
    status = "PASS" if match else "FAIL"
    print(f"[{status}] Expected: [{expected}]")
    print(f"         Got:      [{got}]")

print()
if all_pass3:
    print("ALL PASS! Surya OCR still works!")
else:
    print("REGRESSION - Surya OCR broken!")

# ── Summary ──
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Visual-order born-digital PDF: {'PASS' if all_pass else 'FAIL'}")
print(f"Logical-order born-digital PDF: {'PASS' if all_pass2 else 'FAIL'}")
print(f"Surya OCR (image): {'PASS' if all_pass3 else 'FAIL'}")
if all_pass and all_pass2 and all_pass3:
    print("\nALL TESTS PASSED!")
else:
    print("\nSOME TESTS FAILED!")
