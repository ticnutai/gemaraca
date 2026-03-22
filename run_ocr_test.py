import base64, json, urllib.request, io, os, sys

OUT = r"C:\temp\ocr_test_out.txt"
os.makedirs(r"C:\temp", exist_ok=True)

def log(msg):
    with open(OUT, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("")

log("START")

try:
    r = urllib.request.urlopen("http://127.0.0.1:8399/health", timeout=5)
    log(f"Health: {r.read().decode()}")
except Exception as e:
    log(f"Health error: {e}")
    sys.exit(1)

try:
    from PIL import Image, ImageDraw, ImageFont
    log("PIL imported OK")
except ImportError as e:
    log(f"PIL import error: {e}")
    sys.exit(1)

test_lines = ["שמור וזכור בדיבור אחד", "בראשית ברא אלהים", "הלכה למשה מסיני"]

img = Image.new('RGB', (800, 300), 'white')
draw = ImageDraw.Draw(img)
font = None
for fp in ["C:/Windows/Fonts/david.ttf", "C:/Windows/Fonts/arial.ttf"]:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 40)
            log(f"Font: {fp}")
            break
        except:
            pass
if not font:
    font = ImageFont.load_default()
    log("Default font")

y = 30
for line in test_lines:
    bbox = draw.textbbox((0, 0), line, font=font)
    draw.text((800 - (bbox[2] - bbox[0]) - 20, y), line, fill='black', font=font)
    y += 80

buf = io.BytesIO()
img.save(buf, format='PNG')
b64 = base64.b64encode(buf.getvalue()).decode()
log(f"Image ready: {len(b64)} bytes b64")

data = json.dumps({"image": f"data:image/png;base64,{b64}", "engine": "surya"}).encode()
req = urllib.request.Request('http://127.0.0.1:8399/ocr/base64', data=data, headers={'Content-Type': 'application/json'}, method='POST')

try:
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read().decode())
    log(f"Status: {result.get('status')}")
    log(f"Engine: {result.get('engine')}")
    if result.get('pages'):
        page = result['pages'][0]
        for i, line in enumerate(page.get('lines', [])):
            t = line.get('text', '').strip()
            e = test_lines[i].strip() if i < len(test_lines) else "(extra)"
            log(f"Line {i}: Expected=[{e}] Got=[{t}]")
            if line.get('original_text'):
                log(f"  Pre-corrections: [{line['original_text']}]")
        log(f"Full text:\n{page.get('full_text', '')}")
        
        # Reversal check
        for i, line in enumerate(page.get('lines', [])):
            t = line.get('text', '').strip()
            e = test_lines[i].strip() if i < len(test_lines) else None
            if e:
                if t == e:
                    log(f"Line {i}: CORRECT order")
                elif ' '.join(reversed(t.split())) == e:
                    log(f"Line {i}: REVERSED order!")
                else:
                    log(f"Line {i}: Different text (OCR accuracy)")
except Exception as e:
    log(f"OCR error: {e}")
    import traceback
    log(traceback.format_exc())

log("DONE")
