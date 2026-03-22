"""
E2E test: Test both born-digital PDF and image-based OCR paths.
Determines which path produces character-reversed Hebrew text.
"""
import io, base64, json, urllib.request, sys

def call_ocr(b64_data, filename, engine="auto"):
    data = json.dumps({
        "image": b64_data,
        "filename": filename,
        "engine": engine,
    }).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8399/ocr/base64",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = urllib.request.urlopen(req, timeout=120)
    return json.loads(resp.read().decode())

def check_health():
    try:
        r = urllib.request.urlopen("http://127.0.0.1:8399/health", timeout=5)
        return json.loads(r.read().decode())
    except Exception as e:
        print(f"Server DOWN: {e}")
        sys.exit(1)

print("=" * 60)
print("E2E BiDi Test")
print("=" * 60)

health = check_health()
print(f"Server: {health['status']}, Models: {health['models_loaded']}")

# ── Test 1: Born-digital PDF ──
print("\n" + "─" * 60)
print("TEST 1: Born-digital PDF")
print("─" * 60)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    pdfmetrics.registerFont(TTFont("David", "C:/Windows/Fonts/david.ttf"))
    
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("David", 24)
    
    test_lines = [
        "שמור וזכור בדיבור אחד",
        "בראשית ברא אלהים",
        "הלכה למשה מסיני",
    ]
    
    y = 750
    for line in test_lines:
        c.drawRightString(550, y, line)
        y -= 40
    
    c.save()
    pdf_bytes = buf.getvalue()
    b64 = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode()
    
    result = call_ocr(b64, "test_born_digital.pdf", "auto")
    engine = result.get("engine", "?")
    print(f"Engine used: {engine}")
    
    page = result["pages"][0]
    lines = page.get("text_lines", [])
    
    for i, expected in enumerate(test_lines):
        got = lines[i]["text"].strip() if i < len(lines) else "(missing)"
        match = got == expected
        rev_match = got[::-1] == expected
        words_rev = " ".join(got.split()[::-1]) == expected
        
        status = "PASS" if match else "FAIL"
        print(f"  [{status}] Expected: [{expected}]")
        print(f"           Got:      [{got}]")
        if not match:
            if rev_match:
                print(f"           >>> CHAR REVERSED!")
            elif words_rev:
                print(f"           >>> WORD ORDER REVERSED!")
            else:
                # Check if individual words are char-reversed
                exp_words = expected.split()
                got_words = got.split()
                if len(exp_words) == len(got_words):
                    all_rev = all(e == g[::-1] for e, g in zip(exp_words, got_words))
                    if all_rev:
                        print(f"           >>> EACH WORD IS CHAR-REVERSED + WORD ORDER OK")
                    else:
                        # Check reversed word order + reversed chars
                        all_rev2 = all(e == g[::-1] for e, g in zip(exp_words, got_words[::-1]))
                        if all_rev2:
                            print(f"           >>> EACH WORD CHAR-REVERSED + WORD ORDER REVERSED")
    
    print(f"  Full text: [{page.get('full_text', '').strip()[:200]}]")

except ImportError:
    print("  SKIP: reportlab not installed, testing with fpdf2...")
    try:
        from fpdf import FPDF
        
        pdf = FPDF()
        pdf.add_page()
        pdf.add_font("David", "", "C:/Windows/Fonts/david.ttf")
        pdf.set_font("David", size=24)
        
        test_lines = [
            "שמור וזכור בדיבור אחד",
            "בראשית ברא אלהים",
            "הלכה למשה מסיני",
        ]
        
        for line in test_lines:
            pdf.cell(0, 15, line, new_x="LMARGIN", new_y="NEXT")
        
        pdf_bytes = pdf.output()
        b64 = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode()
        
        result = call_ocr(b64, "test_born_digital.pdf", "auto")
        engine = result.get("engine", "?")
        print(f"Engine used: {engine}")
        
        page = result["pages"][0]
        lines_out = page.get("text_lines", [])
        
        for i, expected in enumerate(test_lines):
            got = lines_out[i]["text"].strip() if i < len(lines_out) else "(missing)"
            status = "PASS" if got == expected else "FAIL"
            print(f"  [{status}] Expected: [{expected}]")
            print(f"           Got:      [{got}]")
        
        print(f"  Full text: [{page.get('full_text', '').strip()[:200]}]")
    except ImportError:
        print("  SKIP: No PDF library available. Creating minimal PDF manually.")
        # Won't test born-digital

# ── Test 2: Image-based (Surya OCR) ──
print("\n" + "─" * 60)
print("TEST 2: Image-based (Surya OCR)")
print("─" * 60)

from PIL import Image, ImageDraw, ImageFont
from bidi.algorithm import get_display

test_lines_2 = [
    "שמור וזכור בדיבור אחד",
    "בראשית ברא אלהים",
    "הלכה למשה מסיני",
]

font = ImageFont.truetype("C:/Windows/Fonts/david.ttf", 48)
img = Image.new("RGB", (900, 320), "white")
draw = ImageDraw.Draw(img)

y = 30
for phrase in test_lines_2:
    visual = get_display(phrase)
    bbox = draw.textbbox((0, 0), visual, font=font)
    w = bbox[2] - bbox[0]
    draw.text((880 - w, y), visual, fill="black", font=font)
    y += 90

buf2 = io.BytesIO()
img.save(buf2, format="PNG")
b64_img = "data:image/png;base64," + base64.b64encode(buf2.getvalue()).decode()

result2 = call_ocr(b64_img, "test_image.png", "surya")
engine2 = result2.get("engine", "?")
print(f"Engine used: {engine2}")

page2 = result2["pages"][0]
lines2 = page2.get("text_lines", [])

all_pass = True
for i, expected in enumerate(test_lines_2):
    got = lines2[i]["text"].strip() if i < len(lines2) else "(missing)"
    match = got == expected
    if not match:
        all_pass = False
    status = "PASS" if match else "FAIL"
    print(f"  [{status}] Expected: [{expected}]")
    print(f"           Got:      [{got}]")

# ── Test 3: Image-based PDF (Surya, PDF wrapper) ──
print("\n" + "─" * 60)
print("TEST 3: Image-wrapped-in-PDF (forces Surya for PDF)")
print("─" * 60)

# Create a PDF that contains the image (no text layer → Surya will be used)
try:
    img_bytes_buf = io.BytesIO()
    img.save(img_bytes_buf, format="PNG")
    img_bytes = img_bytes_buf.getvalue()
    
    # Minimal PDF with embedded image
    from PIL import Image as PILImage
    img_for_pdf = PILImage.open(io.BytesIO(img_bytes))
    pdf_img_buf = io.BytesIO()
    img_for_pdf.save(pdf_img_buf, format="PDF")
    pdf_img_bytes = pdf_img_buf.getvalue()
    
    b64_pdf_img = "data:application/pdf;base64," + base64.b64encode(pdf_img_bytes).decode()
    
    result3 = call_ocr(b64_pdf_img, "test_image.pdf", "auto")
    engine3 = result3.get("engine", "?")
    print(f"Engine used: {engine3}")
    
    page3 = result3["pages"][0]
    lines3 = page3.get("text_lines", [])
    
    for i, expected in enumerate(test_lines_2):
        got = lines3[i]["text"].strip() if i < len(lines3) else "(missing)"
        match = got == expected
        status = "PASS" if match else "FAIL"
        print(f"  [{status}] Expected: [{expected}]")
        print(f"           Got:      [{got}]")
    
    print(f"  Full text: [{page3.get('full_text', '').strip()[:200]}]")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("E2E TEST COMPLETE")
print("=" * 60)
