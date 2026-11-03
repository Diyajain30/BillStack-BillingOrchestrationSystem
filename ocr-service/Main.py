from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import easyocr
import re
import io
import cv2
import numpy as np
from PIL import Image
from datetime import datetime

app = FastAPI(title="BillStack Dynamic OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Initializing EasyOCR Reader...")
reader = easyocr.Reader(['en'], gpu=False)
print("EasyOCR Reader initialized successfully!")

GENERIC_HEADERS = {
    "TAX INVOICE", "INVOICE", "BILL", "CASH MEMO", "RETAIL INVOICE",
    "TAX", "ORIGINAL", "DUPLICATE", "ESTIMATE", "RECEIPT", "BILL VOUCHER", "POS", "SALES RECEIPT"
}

def preprocess_image(pil_img: Image.Image) -> np.ndarray:
    img = np.array(pil_img.convert('RGB'))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    
    h, w = gray.shape
    if w < 1400:
        scale = 1400 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    
    if np.mean(gray) < 127:
        gray = cv2.bitwise_not(gray)

    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    norm = cv2.normalize(denoised, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    return norm

def cluster_into_rows(ocr_results):
    if not ocr_results:
        return []

    boxes = []
    for bbox, text, conf in ocr_results:
        cleaned = text.strip()
        if not cleaned or len(cleaned) < 2:
            continue
        y_top = min(bbox[0][1], bbox[1][1])
        y_bottom = max(bbox[2][1], bbox[3][1])
        y_center = (y_top + y_bottom) / 2.0
        x_left = min(bbox[0][0], bbox[3][0])
        height = y_bottom - y_top
        boxes.append({"text": cleaned, "yc": y_center, "x": x_left, "h": height, "yt": y_top, "yb": y_bottom})

    if not boxes:
        return []

    boxes.sort(key=lambda b: b["yt"])
    rows = []
    current_row = [boxes[0]]

    for b in boxes[1:]:
        ref = current_row[-1]
        vertical_overlap = max(0, min(ref["yb"], b["yb"]) - max(ref["yt"], b["yt"]))
        min_h = min(ref["h"], b["h"])
        
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

def extract_vendor_name(rows) -> str:
    for row in rows[:4]:
        upper_row = row.upper()
        if any(header in upper_row for header in GENERIC_HEADERS):
            continue
        if re.search(r'\d{5,}|ph:|tel:|gstin|date|invoice', upper_row):
            continue
        clean_name = re.sub(r'[^A-Z0-9\s&.]', '', upper_row).strip()
        if len(clean_name) > 2:
            return row.strip()
    return "Unknown Vendor"

def extract_invoice_number(full_text: str, rows) -> str:
    match = re.search(r'(?:txn|invoice|inv|bill)\s*(?:#|no\.?|number)?\s*[:\-]?\s*([A-Za-z0-9\-_/]+)', full_text, re.IGNORECASE)
    if match:
        val = match.group(1).strip()
        if val.upper() not in ["RECEIPT", "INVOICE", "SALES", "TAX"]:
            return val

    for row in rows[:8]:
        code_match = re.search(r'\b\d{5,8}\b|\b[A-Z]{2,4}-\d{4}-\d{3,4}\b', row)
        if code_match:
            return code_match.group(0)

    return "N/A"

def extract_date(full_text: str) -> str:
    m1 = re.search(r'\b(\d{4})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b', full_text)
    if m1:
        return f"{m1.group(1)}-{m1.group(2)}-{m1.group(3)}"
    
    m2 = re.search(r'\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](\d{4})\b', full_text)
    if m2:
        return f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)}"

    return datetime.now().strftime("%Y-%m-%d")

def extract_prices(text: str):
    """Universal price extractor supporting both decimals and whole numbers."""
    cleaned = text.replace('₹', ' ').replace('Rs.', ' ').replace('RS.', ' ').replace('$', ' ').replace('INR', ' ')
    matches = re.findall(r'\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b|\b\d+(?:\.\d{1,2})?\b', cleaned)
    vals = []
    for m in matches:
        try:
            v = float(m.replace(',', ''))
            # Filter out years and small indices/quantities (like item index 1, 2, 3)
            if v not in (2024.0, 2025.0, 2026.0, 2027.0, 2028.0) and v > 0.5:
                vals.append(v)
        except ValueError:
            pass
    return vals

def extract_grand_total(full_text: str, rows) -> float:
    """Robust multi-layered total extractor with smart fallback."""
    # 1. Search for explicit grand total keywords with figures
    gt_match = re.search(r'(?:GRAND\s*TOTAL|NET\s*PAYABLE|FINAL\s*TOTAL|TOTAL\s*AMOUNT|TOTAL\s*DUE)[^\d]*([\d,]+(?:\.\d{1,2})?)', full_text, re.IGNORECASE)
    if gt_match:
        try:
            return float(gt_match.group(1).replace(',', ''))
        except ValueError:
            pass

    # 2. Search for generic TOTAL (excluding SUBTOTAL)
    tot_match = re.search(r'(?<!SUB)\bTOTAL[^\d]*([\d,]+(?:\.\d{1,2})?)', full_text, re.IGNORECASE)
    if tot_match:
        try:
            return float(tot_match.group(1).replace(',', ''))
        except ValueError:
            pass

    # 3. Row-by-row keyword check
    for row in rows:
        upper = row.upper()
        if any(kw in upper for kw in ["GRAND TOTAL", "NET PAYABLE", "TOTAL"]):
            if "SUB" not in upper:
                prices = extract_prices(row)
                if prices:
                    return prices[-1]

    # 4. Ultimate Fallback: Return the maximum valid monetary amount found on the bill
    all_prices = extract_prices(full_text)
    if all_prices:
        return max(all_prices)

    return 500.0 # Safety default

@app.post("/extract-bill")
async def extract_bill(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        raw_pil = Image.open(io.BytesIO(contents))
        processed_np = preprocess_image(raw_pil)

        raw_ocr = reader.readtext(processed_np, detail=1, paragraph=False)
        merged_rows = cluster_into_rows(raw_ocr)
        full_text = "\n".join(merged_rows)

        vendor_name = extract_vendor_name(merged_rows)
        bill_no = extract_invoice_number(full_text, merged_rows)
        bill_date = extract_date(full_text)
        grand_total = extract_grand_total(full_text, merged_rows)

        return {
            "status": "Success",
            "data": {
                "vendorName": vendor_name,
                "billNo": bill_no,
                "amount": float(grand_total),
                "billDate": bill_date,
                "description": f"Auto-extracted via BillStack OCR from {vendor_name}"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)