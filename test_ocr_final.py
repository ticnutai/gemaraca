"""Definitive OCR BiDi verification - full test with 3 Hebrew phrases."""
import io, base64, json, urllib.request
from PIL import Image, ImageDraw, ImageFont
from bidi.algorithm import get_display

test_phrases = [
    "שמור וזכור בדיבור אחד",
    "בראשית ברא אלהים",
    "הלכה למשה מסיני",
]

font = ImageFont.truetype("C:/Windows/Fonts/david.ttf", 48)
img = Image.new("RGB", (900, 320), "white")
draw = ImageDraw.Draw(img)

y = 30
for phrase in test_phrases:
    visual = get_display(phrase)
    bbox = draw.textbbox((0, 0), visual, font=font)
    w = bbox[2] - bbox[0]
    draw.text((880 - w, y), visual, fill="black", font=font)
    y += 90

buf = io.BytesIO()
img.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode()

data = json.dumps({"image": f"data:image/png;base64,{b64}", "engine": "surya"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8399/ocr/base64",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
resp = urllib.request.urlopen(req, timeout=120)
result = json.loads(resp.read().decode())

page = result["pages"][0]
lines = [l["text"].strip() for l in page.get("text_lines", [])]

print("=" * 60)
all_pass = True
for i, expected in enumerate(test_phrases):
    got = lines[i] if i < len(lines) else "(missing)"
    status = "PASS" if got == expected else "FAIL"
    if got != expected:
        all_pass = False
    print(f"[{status}] Expected: [{expected}]")
    print(f"         Got:      [{got}]")
    print()

print("=" * 60)
if all_pass:
    print("ALL TESTS PASSED - BiDi fix verified!")
else:
    print("SOME TESTS FAILED")

confidences = [l["confidence"] for l in page.get("text_lines", [])]
print(f"Confidence: {confidences}")
print(f"Engine: {result['engine']}")
print(f"Processing time: {result['processing_time_seconds']:.2f}s")
