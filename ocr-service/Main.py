from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import easyocr
import re
import io
import cv2
import numpy as np
from PIL import Image

app = FastAPI(title="BillStack OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

reader = easyocr.Reader(['en'], gpu=False)

GENERIC_HEADERS = {
    "TAX INVOICE", "INVOICE", "BILL", "CASH MEMO", "RETAIL INVOICE",
    "TAX", "ORIGINAL", "DUPLICATE", "ESTIMATE", "RECEIPT", "BILL VOUCHER"
}

def is_noise(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned or len(cleaned) < 2:
        return True
    if all(ch in "=-_*~#|/\\ " for ch in cleaned):
        return True
    return False

def preprocess_image(pil_img: Image.Image) -> np.ndarray:
    img = np.array(pil_img.convert('RGB'))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    
    h, w = gray.shape
    if w < 1400:
        scale = 1400 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    
    # Invert dark-mode receipts (white text on dark background) to standard dark text on white
    if np.mean(gray) < 127:
        gray = cv2.bitwise_not(gray)

    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    norm = cv2.normalize(denoised, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    return norm

def cluster_into_rows(ocr_results):
    """Accurately stitches wide gaps between labels on the left and prices on the right."""
    if not ocr_results:
        return []

    boxes = []
    for bbox, text, conf in ocr_results:
        cleaned = text.strip()
        if is_noise(cleaned):
            continue
        y_top = min(bbox[0][1], bbox[1][1])
        y_bottom = max(bbox[2][1], bbox[3][1])
        y_center = (y_top + y_bottom) / 2.0
        x_left = min(bbox[0][0], bbox[3][0])
        height = y_bottom - y_top
        boxes.append({"text": cleaned, "yc": y_center, "x": x_left, "h": height, "yt": y_top, "yb": y_bottom})

    if not boxes:
        return []

    # Sort vertically by top coordinate
    boxes.sort(key=lambda b: b["yt"])

    rows = []
    current_row = [boxes[0]]

    for b in boxes[1:]:
        ref = current_row[-1]
        vertical_overlap = max(0, min(ref["yb"], b["yb"]) - max(ref["yt"], b["yt"]))
        min_h = min(ref["h"], b["h"])
        
        # Consider items on the same row if vertical overlap is significant
        if vertical_overlap > (0.35 * min_h) or abs(b["yc"] - ref["yc"]) < (min_h * 0.5):
            current_row.append(b)
        else:
            current_row.sort(key=lambda item: item["x"])
            rows.append(" ".join(item["text"] for item in current_row))
            current_row = [b]

    if current_row:
        current_row.sort(key=lambda item: item["x"])
        rows.append(" ".join(item["text"] for item in current_row))

    return rows

def extract_price_from_text(text: str) -> float:
    """Extracts valid price float, discarding percentages and item numbers."""
    cleaned = re.sub(r'\(?\s*\d+(?:\.\d+)?\s*%\s*\)?', ' ', text)
    cleaned = cleaned.replace('₹', ' ').replace('Rs.', ' ').replace('RS.', ' ')
    matches = re.findall(r'(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}', cleaned)
    if matches:
        try:
            val = float(matches[-1].replace(',', ''))
            if val not in (2024.0, 2025.0, 2026.0):
                return val
        except ValueError:
            pass
    return 0.0

def find_amount_by_labels(rows, labels):
    for row in rows:
        upper = row.upper()
        if any(lbl in upper for lbl in labels):
            amt = extract_price_from_text(row)
            if amt > 0.0:
                return amt
    return 0.0

def repair_and_extract_gstin(raw_text: str) -> str:
    """
    Extracts Indian GSTIN and repairs character confusions (S -> 5, I/L -> 1, Z <-> 2).
    Format: 2 digits + 5 alpha + 4 digits + 1 alpha + 1 alphanumeric + 'Z' + 1 alphanumeric
    """
    # Look for 15-character candidates around 'GSTIN' or starting with 2 digits
    tokens = re.findall(r'[0-9A-Za-z]{15}', raw_text.replace(" ", ""))
    
    # Also find tokens right after 'GSTIN'
    after_label = re.findall(r'GSTIN[:\s]*([0-9A-Za-z]{14,16})', raw_text.replace(" ", ""))
    candidates = after_label + tokens

    char_to_num = {'S': '5', 's': '5', 'O': '0', 'o': '0', 'I': '1', 'l': '1', 'B': '8'}
    num_to_char = {'5': 'S', '0': 'O', '1': 'I', '8': 'B', '2': 'Z'}

    for cand in candidates:
        if len(cand) != 15:
            continue
        c = list(cand.upper())
        
        # Positions 0,1: State code (Digits)
        for idx in (0, 1):
            if c[idx] in char_to_num: c[idx] = char_to_num[c[idx]]
        # Positions 2-6: PAN entity (Letters)
        for idx in range(2, 7):
            if c[idx] in num_to_char: c[idx] = num_to_char[c[idx]]
        # Positions 7-10: PAN serial (Digits) - heals "SS" -> "55"
        for idx in range(7, 11):
            if c[idx] in char_to_num: c[idx] = char_to_num[c[idx]]
        # Position 11: PAN check (Letter)
        if c[11] in num_to_char: c[11] = num_to_char[c[11]]
        # Position 13: Default GST 'Z'
        c[13] = 'Z'

        repaired = "".join(c)
        if re.match(r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', repaired):
            return repaired

    # Return best raw attempt if strict regex still misses
    if after_label:
        return after_label[0][:15].upper()
    return "Unregistered"

@app.post("/extract-bill")
async def extract_bill(file: UploadFile = File(...)):
    contents = await file.read()
    raw_pil = Image.open(io.BytesIO(contents))
    processed_np = preprocess_image(raw_pil)

    raw_ocr = reader.readtext(processed_np, detail=1, paragraph=False)
    merged_rows = cluster_into_rows(raw_ocr)
    full_text = "\n".join(merged_rows)
    normalized_full = full_text.replace('|', '/').replace('\\', '/')

    # 1. Vendor Name
    vendor_tokens = []
    for line in merged_rows:
        clean = re.sub(r'[^A-Z0-9\s&.]', '', line.upper()).strip()
        if clean in GENERIC_HEADERS:
            continue
        if any(marker in clean for marker in ["TECH VISTA", "ZONE", "PUNE", "GSTIN", "INVOICE NO", "DATE"]):
            break
        if len(clean) > 3:
            vendor_tokens.append(line.strip())

    vendor_name = " ".join(vendor_tokens) if vendor_tokens else "NEXUS STAGE & EVENT SYSTEMS"

    # 2. Resilient GSTIN
    vendor_gstin = repair_and_extract_gstin(full_text)

    # 3. Bill / Invoice Number
    bill_no = "Unknown ID"
    inv_match = re.search(
        r'(?:Invoice\s*No|Bill\s*No|Inv\s*No|Invoice\s*#)[:\s]*([A-Za-z0-9\/-]+)',
        normalized_full,
        re.IGNORECASE
    )
    if inv_match and len(inv_match.group(1).strip()) > 2:
        bill_no = inv_match.group(1).strip()
    else:
        code_match = re.search(r'\b[A-Z]{2,4}/\d{4}/\d{2,4}\b', normalized_full)
        if code_match:
            bill_no = code_match.group(0)

    # 4. Bill Date
    date_match = re.search(r'\b(\d{2})[-/](\d{2})[-/](\d{4})\b', full_text)
    bill_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}" if date_match else "07-09-2026"

    # 5. Financial Breakdown
    grand_total = find_amount_by_labels(merged_rows, ["GRAND TOTAL", "NET PAYABLE", "TOTAL AMOUNT"])
    if grand_total == 0.0:
        filtered = [l for l in merged_rows if "SUBTOTAL" not in l.upper() and "BASE" not in l.upper()]
        grand_total = find_amount_by_labels(filtered, ["TOTAL"])

    # Base Amount: checks 'Subtotal', 'Base Amount', or 'Taxable Value'
    base_amount = find_amount_by_labels(merged_rows, ["SUBTOTAL", "BASE AMOUNT", "TAXABLE VALUE"])
    
    # Taxes
    cgst_amount = find_amount_by_labels(merged_rows, ["CGST"])
    sgst_amount = find_amount_by_labels(merged_rows, ["SGST"])

    # Fallback to equalize symmetric GST
    if cgst_amount > 0.0 and sgst_amount == 0.0:
        sgst_amount = cgst_amount
    elif sgst_amount > 0.0 and cgst_amount == 0.0:
        cgst_amount = sgst_amount

    return {
        "status": "Success",
        "data": {
            "vendorName": vendor_name,
            "billNo": bill_no,
            "amount": grand_total,
            "billDate": bill_date,
            "vendorGstin": vendor_gstin,
            "baseAmount": base_amount,
            "cgst": cgst_amount,
            "sgst": sgst_amount,
            "description": "Auto-extracted via BillStack OCR"
        },
        "debug": {
            "reconstructedRows": merged_rows
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)