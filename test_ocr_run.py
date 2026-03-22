"""OCR verification test - writes results to test_ocr_output.txt"""
import base64, json, urllib.request, io, os, sys

RESULTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_ocr_output.txt")

def log(msg):
    with open(RESULTS_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")
    print(msg)

# Clear file
with open(RESULTS_FILE, "w", encoding="utf-8") as f:
    f.write("")

log("=== OCR Hebrew Verification Test ===")

# Step 1: Health check
try:
    r = urllib.request.urlopen("http://127.0.0.1:8399/health", timeout=5)
    health = json.loads(r.read().decode())
    log(f"Server health: {json.dumps(health, ensure_ascii=False)}")
except Exception as e:
    log(f"ERROR: Server not reachable: {e}")
    sys.exit(1)

# Step 2: Create test image
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    log("ERROR: PIL not installed. Trying alternative approach...")
    sys.exit(1)

test_lines = [
    "שמור וזכור בדיבור אחד",
    "בראשית ברא אלהים",
    "הלכה למשה מסיני",
]

width, height = 800, 300
img = Image.new('RGB', (width, height), 'white')
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
    log("Using default font")

y = 30
for line in test_lines:
    bbox = draw.textbbox((0, 0), line, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((width - tw - 20, y), line, fill='black', font=font)
    y += 80

buf = io.BytesIO()
img.save(buf, format='PNG')
b64 = base64.b64encode(buf.getvalue()).decode()

log(f"\nTest image created ({len(b64)} bytes base64)")
log(f"Expected lines:")
for i, l in enumerate(test_lines):
    log(f"  [{i}] {l}")

# Step 3: Send to OCR
log("\n=== Sending to OCR (Surya engine) ===")
data = json.dumps({"image": f"data:image/png;base64,{b64}", "engine": "surya"}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8399/ocr/base64',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read().decode())
    
    log(f"\nOCR Status: {result.get('status')}")
    log(f"Engine: {result.get('engine')}")
    log(f"Lines found: {result.get('total_lines')}")
    
    if result.get('pages'):
        page = result['pages'][0]
        lines = page.get('lines', [])
        
        log("\n=== LINE-BY-LINE COMPARISON ===")
        for i, line in enumerate(lines):
            ocr_text = line.get('text', '').strip()
            expected = test_lines[i].strip() if i < len(test_lines) else "(extra)"
            match = "MATCH" if ocr_text == expected else "DIFFER"
            log(f"\nLine {i}: {match}")
            log(f"  Expected: [{expected}]")
            log(f"  Got:      [{ocr_text}]")
            if line.get('confidence'):
                log(f"  Confidence: {line['confidence']}")
            if line.get('original_text'):
                log(f"  Pre-corrections: [{line['original_text']}]")
        
        full_text = page.get('full_text', '')
        log(f"\n=== FULL TEXT ===")
        log(full_text)
        
        # Word order check
        log(f"\n=== WORD ORDER CHECK ===")
        for part in full_text.split('\n'):
            if part.strip():
                words = part.strip().split()
                if len(words) >= 2:
                    log(f"  Line: [{part.strip()}]")
                    log(f"    Words: {words}")
                    # In correct logical order, first word = rightmost visually
                    # For "שמור וזכור" - first word should be שמור
                    first_char = words[0][0] if words[0] else ''
                    log(f"    First word starts with: {first_char} (U+{ord(first_char):04X})" if first_char else "")

        # Reversed check - does any line look reversed?
        log(f"\n=== REVERSAL CHECK ===")
        for i, line in enumerate(lines):
            ocr_text = line.get('text', '').strip()
            reversed_text = ' '.join(reversed(ocr_text.split()))
            expected = test_lines[i].strip() if i < len(test_lines) else None
            if expected:
                if ocr_text == expected:
                    log(f"  Line {i}: CORRECT order")
                elif reversed_text == expected:
                    log(f"  Line {i}: REVERSED! (words are in wrong order)")
                else:
                    log(f"  Line {i}: Different text (OCR accuracy issue, not order)")
                    
    log("\n=== TEST COMPLETE ===")
    
except Exception as e:
    log(f"ERROR: {e}")
    import traceback
    log(traceback.format_exc())
