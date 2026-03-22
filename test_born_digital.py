"""
E2E test for born-digital PDF path.
Creates a Hebrew PDF with embedded text and sends it to the OCR server.
Tests if pdfplumber returns text in visual or logical order.
"""
import io, base64, json, urllib.request

test_lines = [
    "שמור וזכור בדיבור אחד",
    "בראשית ברא אלהים את השמים ואת הארץ",
    "הלכה למשה מסיני",
    "והארץ היתה תהו ובהו וחשך על פני תהום",
    "ורוח אלהים מרחפת על פני המים",
]

# ── Step 1: Create born-digital PDF with fpdf2 ──
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.add_font("David", "", "C:/Windows/Fonts/david.ttf")
pdf.set_font("David", size=18)

for line in test_lines:
    pdf.cell(0, 12, line, new_x="LMARGIN", new_y="NEXT")

pdf_bytes = pdf.output()
print(f"Created PDF: {len(pdf_bytes)} bytes")

# ── Step 1b: Verify what pdfplumber sees locally ──
import pdfplumber
p = pdfplumber.open(io.BytesIO(pdf_bytes))
print("\n--- pdfplumber direct extraction ---")
for i, page in enumerate(p.pages):
    raw = page.extract_text() or ""
    print(f"Page {i+1}:")
    for line in raw.split("\n"):
        if line.strip():
            print(f"  [{line.strip()}]")
p.close()

# ── Step 2: Send PDF to OCR server ──
b64 = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode()
data = json.dumps({
    "image": b64,
    "filename": "test_born_digital.pdf",
    "engine": "auto",
}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8399/ocr/base64",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
resp = urllib.request.urlopen(req, timeout=120)
result = json.loads(resp.read().decode())

engine = result.get("engine", "?")
print(f"\n--- Server response ---")
print(f"Engine: {engine}")
print(f"Pages: {len(result.get('pages', []))}")
print(f"Total lines: {result.get('total_lines', 0)}")
print(f"Time: {result.get('processing_time_seconds', 0)}s")

page = result["pages"][0]
server_lines = [l["text"].strip() for l in page.get("text_lines", [])]

print(f"\n--- Results ---")
all_pass = True
for i, expected in enumerate(test_lines):
    got = server_lines[i] if i < len(server_lines) else "(missing)"
    match = got == expected
    if not match:
        all_pass = False
    status = "PASS" if match else "FAIL"
    print(f"[{status}] Expected: [{expected}]")
    print(f"         Got:      [{got}]")
    if not match:
        # Diagnostic: check reversal type
        if got[::-1] == expected:
            print(f"         >>> FULL STRING REVERSED!")
        elif " ".join(got.split()[::-1]) == expected:
            print(f"         >>> WORD ORDER REVERSED!")
        else:
            # Check per-word char reversal
            ew = expected.split()
            gw = got.split()
            if len(ew) == len(gw) and all(e == g[::-1] for e, g in zip(ew, gw)):
                print(f"         >>> EACH WORD CHAR-REVERSED!")
            elif len(ew) == len(gw) and all(e == g[::-1] for e, g in zip(ew, reversed(gw))):
                print(f"         >>> WORDS REVERSED + CHARS REVERSED!")
    print()

if all_pass:
    print("ALL PASS - Born-digital path works correctly!")
else:
    print("FAILED - Born-digital path produces wrong text order!")
