"""Check PIL Hebrew rendering + test if _fix_bidi is needed for Surya output"""
import os, io, base64, json

OUT = r"C:\temp\ocr_test2.txt"
os.makedirs(r"C:\temp", exist_ok=True)

def log(msg):
    with open(OUT, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("")

from PIL import Image, ImageDraw, ImageFont, features

# Check PIL RTL support
log(f"Pillow version: {Image.__version__}")
log(f"libraqm available: {features.check('raqm')}")
log(f"fribidi available: {features.check_feature('fribidi')}")
log(f"harfbuzz available: {features.check_feature('harfbuzz')}")

# Test 1: Render with direction="rtl" if available
test_text = "שמור וזכור"
img = Image.new('RGB', (400, 100), 'white')
draw = ImageDraw.Draw(img)
font = ImageFont.truetype("C:/Windows/Fonts/david.ttf", 40)

# Try rendering with explicit direction
try:
    draw.text((10, 10), test_text, fill='black', font=font, direction="rtl")
    log("Rendered with direction='rtl' - libraqm present")
except (TypeError, KeyError, ValueError):
    draw.text((10, 10), test_text, fill='black', font=font)
    log("Rendered without direction param - NO libraqm (PIL renders LTR)")

# Check pixel positions - where is first char drawn?
# If RTL: rightmost pixels should have the first char (shin/שׁ)  
# If LTR: leftmost pixels should have the first char
pixels = img.load()
# Find leftmost and rightmost non-white columns
min_x = 400
max_x = 0
for x in range(400):
    for y in range(100):
        if pixels[x, y] != (255, 255, 255):
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            break

log(f"Text spans from x={min_x} to x={max_x}")

# Save image for inspection
img_path = r"C:\temp\hebrew_render_test.png"
img.save(img_path)
log(f"Saved test render to {img_path}")

# Test 2: Use get_display BEFORE rendering (pre-apply visual order)
from bidi.algorithm import get_display
visual_text = get_display(test_text)
log(f"Original (logical): [{test_text}]")
log(f"get_display result: [{visual_text}]")

img2 = Image.new('RGB', (400, 100), 'white')
draw2 = ImageDraw.Draw(img2)
draw2.text((10, 10), visual_text, fill='black', font=font)
img2.save(r"C:\temp\hebrew_visual_test.png")
log(f"Saved visual-order render to C:\\temp\\hebrew_visual_test.png")

# Test 3: OCR both images and compare
import urllib.request

log("\n=== OCR TEST: Image with LOGICAL order text ===")
buf1 = io.BytesIO()
img.save(buf1, format='PNG')
b64_1 = base64.b64encode(buf1.getvalue()).decode()

data1 = json.dumps({"image": f"data:image/png;base64,{b64_1}", "engine": "surya"}).encode()
req1 = urllib.request.Request('http://127.0.0.1:8399/ocr/base64', data=data1, headers={'Content-Type': 'application/json'}, method='POST')
try:
    resp1 = urllib.request.urlopen(req1, timeout=60)
    r1 = json.loads(resp1.read().decode())
    ft1 = r1.get('pages', [{}])[0].get('full_text', '')
    log(f"OCR of logical-render: [{ft1.strip()}]")
except Exception as e:
    log(f"OCR error: {e}")

log("\n=== OCR TEST: Image with VISUAL order text ===")  
buf2 = io.BytesIO()
img2.save(buf2, format='PNG')
b64_2 = base64.b64encode(buf2.getvalue()).decode()

data2 = json.dumps({"image": f"data:image/png;base64,{b64_2}", "engine": "surya"}).encode()
req2 = urllib.request.Request('http://127.0.0.1:8399/ocr/base64', data=data2, headers={'Content-Type': 'application/json'}, method='POST')
try:
    resp2 = urllib.request.urlopen(req2, timeout=60)
    r2 = json.loads(resp2.read().decode())
    ft2 = r2.get('pages', [{}])[0].get('full_text', '')
    log(f"OCR of visual-render: [{ft2.strip()}]")
except Exception as e:
    log(f"OCR error: {e}")

# Test 4: Apply _fix_bidi to the OCR results  
log("\n=== APPLYING get_display TO OCR RESULTS ===")
if ft1:
    fixed_1 = get_display(ft1.strip())
    log(f"OCR(logical) -> get_display: [{fixed_1}]")
    log(f"Matches original? {fixed_1 == test_text}")
if ft2:
    fixed_2 = get_display(ft2.strip())
    log(f"OCR(visual)  -> get_display: [{fixed_2}]")
    log(f"Matches original? {fixed_2 == test_text}")

log("\n=== CONCLUSION ===")
if ft1 and get_display(ft1.strip()) == test_text:
    log("SURYA OUTPUTS VISUAL ORDER -> _fix_bidi IS NEEDED")
elif ft1 and ft1.strip() == test_text:
    log("SURYA OUTPUTS LOGICAL ORDER -> _fix_bidi NOT needed")
else:
    log(f"INCONCLUSIVE - OCR text doesn't match expected. Possible PIL rendering issue.")
    log(f"Expected: [{test_text}]")
    log(f"OCR got:  [{ft1.strip() if ft1 else 'N/A'}]")
    log(f"After get_display: [{get_display(ft1.strip()) if ft1 else 'N/A'}]")

log("\nDONE")
