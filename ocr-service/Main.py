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
    "TAX", "ORIGINAL", "DUPLICATE", "ESTIMATE", "RECEIPT", "BILL VOUCHER",
    "POS", "SALES RECEIPT", "ORIGINAL FOR RECIPIENT", "BILL OF SUPPLY"
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
        if not cleaned:
            continue
        y_top = min(bbox[0][1], bbox[1][1])
        y_bottom = max(bbox[2][1], bbox[3][1])
        y_center = (y_top + y_bottom) / 2.0
        x_left = min(bbox[0][0], bbox[3][0])
        height = max(y_bottom - y_top, 1.0)
        boxes.append({
            "text": cleaned, "yc": y_center, "x": x_left,
            "h": height, "yt": y_top, "yb": y_bottom
        })

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
    for row in rows[:6]:
        upper_row = row.upper().strip()
        if any(upper_row == header or upper_row.startswith(header + " ") for header in GENERIC_HEADERS):
            continue
        if re.search(r'\d{5,}|PH:|TEL:|MOB|GSTIN|GST\s*NO|DATE|INVOICE\s*NO|BILL\s*NO|EMAIL|WWW\.', upper_row):
            continue
        clean_name = re.sub(r'[^A-Z0-9\s&.\-]', '', upper_row).strip()
        if len(clean_name) > 2:
            return row.strip()
    return "Unknown Vendor"


def extract_invoice_number(full_text: str, rows) -> str:
    patterns = [
        r'(?:tax\s*invoice|invoice|inv|bill|receipt|voucher|memo|txn)\s*(?:no\.?|number|#|id)?\s*[:\-–=]\s*([A-Za-z0-9][A-Za-z0-9\-_/\.]{1,24})',
        r'(?:invoice|inv|bill)\s+(?:no\.?|#|number)\s+([A-Za-z0-9][A-Za-z0-9\-_/\.]{1,24})',
    ]
    blacklist = {"RECEIPT", "INVOICE", "SALES", "TAX", "DATE", "NO", "NUMBER", "BILL", "GSTIN", "TOTAL", "AMOUNT"}

    for pat in patterns:
        for m in re.finditer(pat, full_text, re.IGNORECASE):
            val = m.group(1).strip(" .,:;")
            if val.upper() not in blacklist and any(ch.isdigit() for ch in val):
                return val

    # Check labeled row where value might sit on the next row
    for idx, row in enumerate(rows[:12]):
        if re.search(r'(?:invoice|inv|bill)\s*(?:no\.?|number|#)', row, re.IGNORECASE):
            tokens = re.findall(r'\b[A-Za-z0-9][A-Za-z0-9\-_/]{2,20}\b', row)
            for tok in reversed(tokens):
                if tok.upper() not in blacklist and any(ch.isdigit() for ch in tok):
                    return tok
            if idx + 1 < len(rows):
                next_tokens = re.findall(r'\b[A-Za-z0-9][A-Za-z0-9\-_/]{2,20}\b', rows[idx + 1])
                for tok in next_tokens:
                    if tok.upper() not in blacklist and any(ch.isdigit() for ch in tok):
                        return tok

    # Fallback: common Indian invoice formats like INV/2025-26/042 or ABC-2026-001
    for row in rows[:10]:
        code_match = re.search(r'\b[A-Z]{2,5}[/\-]\d{2,4}[/\-][A-Z0-9]{2,6}\b|\b\d{5,8}\b', row)
        if code_match:
            return code_match.group(0)

    return ""


def extract_date(full_text: str) -> str:
    # YYYY-MM-DD or YYYY/MM/DD
    m1 = re.search(r'\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b', full_text)
    if m1:
        return f"{m1.group(1)}-{int(m1.group(2)):02d}-{int(m1.group(3)):02d}"

    # DD-MM-YYYY or DD/MM/YYYY
    m2 = re.search(r'\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b', full_text)
    if m2:
        return f"{m2.group(3)}-{int(m2.group(2)):02d}-{int(m2.group(1)):02d}"

    # DD-Mon-YYYY or DD Mon YYYY (e.g., 14-Feb-2026 or 14 Feb 2026)
    m3 = re.search(r'\b(0?[1-9]|[12]\d|3[01])[\s\-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\s\-/,]+(20\d{2})\b', full_text, re.IGNORECASE)
    if m3:
        mon_str = m3.group(2)[:3].title()
        try:
            dt = datetime.strptime(f"{int(m3.group(1)):02d}-{mon_str}-{m3.group(3)}", "%d-%b-%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return datetime.now().strftime("%Y-%m-%d")


def heal_gstin(raw: str) -> str:
    """Fix common OCR confusions in a 15-char Indian GSTIN."""
    s = re.sub(r'[^A-Za-z0-9]', '', raw).upper()
    if len(s) != 15:
        return ""
    to_digit = {'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '2', 'S': '5', 'B': '8'}
    to_alpha = {'0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B'}

    chars = list(s)
    # Positions 0-1: state code (digits)
    for i in (0, 1):
        chars[i] = to_digit.get(chars[i], chars[i])
    # Positions 2-6: PAN letters (alpha)
    for i in range(2, 7):
        chars[i] = to_alpha.get(chars[i], chars[i])
    # Positions 7-10: PAN digits
    for i in range(7, 11):
        chars[i] = to_digit.get(chars[i], chars[i])
    # Position 11: PAN check letter
    chars[11] = to_alpha.get(chars[11], chars[11])
    # Position 13: default 'Z'
    if chars[13] == '2':
        chars[13] = 'Z'

    healed = "".join(chars)
    if re.match(r'^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$', healed):
        return healed
    return ""


def extract_gstin(full_text: str) -> str:
    # 1. Exact standard GSTIN match
    exact = re.search(r'\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b', full_text.upper())
    if exact:
        return exact.group(1)

    # 2. Labeled GSTIN with OCR healing
    labeled = re.search(r'(?:GSTIN|GST\s*NO\.?|GST\s*IN|GST\s*REG\.?)\s*[:\-]?\s*([A-Za-z0-9\s\-]{15,20})', full_text, re.IGNORECASE)
    if labeled:
        candidate = re.sub(r'[\s\-]', '', labeled.group(1))[:15]
        healed = heal_gstin(candidate)
        if healed:
            return healed

    # 3. Any 15-char alphanumeric token that heals into a valid GSTIN
    for tok in re.findall(r'\b[A-Za-z0-9]{15}\b', full_text):
        healed = heal_gstin(tok)
        if healed:
            return healed

    return ""


def extract_prices(text: str):
    """Extract monetary figures while ignoring percentages (like 9%, 18%) and years."""
    cleaned = re.sub(r'\b\d+(?:\.\d+)?\s*%', ' ', text)
    cleaned = re.sub(r'(?:₹|Rs\.?|INR|\$)', ' ', cleaned, flags=re.IGNORECASE)
    matches = re.findall(r'\b\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\b|\b\d+(?:\.\d{1,2})?\b', cleaned)
    vals = []
    for m in matches:
        try:
            v = float(m.replace(',', ''))
            if v not in (2023.0, 2024.0, 2025.0, 2026.0, 2027.0, 2028.0) and v > 0.0:
                vals.append(v)
        except ValueError:
            pass
    return vals


def extract_labeled_amount(rows, keywords, exclude_keywords=None):
    exclude_keywords = exclude_keywords or []
    for row in rows:
        upper = row.upper()
        if any(ex in upper for ex in exclude_keywords):
            continue
        if any(kw in upper for kw in keywords):
            # Take portion after the matched keyword to avoid grabbing rate/qty before it
            prices = extract_prices(row)
            if prices:
                return round(prices[-1], 2)
    return None


def extract_tax_and_totals(full_text: str, rows):
    # Grand Total
    grand_total = extract_labeled_amount(
        rows,
        ["GRAND TOTAL", "NET PAYABLE", "FINAL TOTAL", "INVOICE TOTAL", "TOTAL PAYABLE", "AMOUNT PAYABLE", "TOTAL AMOUNT", "TOTAL DUE"],
        exclude_keywords=["SUB TOTAL", "SUBTOTAL", "TAXABLE"]
    )
    if grand_total is None:
        grand_total = extract_labeled_amount(
            rows,
            ["TOTAL"],
            exclude_keywords=["SUB TOTAL", "SUBTOTAL", "TAXABLE", "TOTAL TAX", "TOTAL GST", "TOTAL QTY"]
        )
    if grand_total is None:
        all_prices = extract_prices(full_text)
        grand_total = round(max(all_prices), 2) if all_prices else 0.0

    # CGST & SGST
    cgst = extract_labeled_amount(rows, ["CGST", "C.G.S.T", "CENTRAL GST"], exclude_keywords=["GSTIN"])
    sgst = extract_labeled_amount(rows, ["SGST", "S.G.S.T", "STATE GST", "UTGST"], exclude_keywords=["GSTIN"])

    # Handle IGST or combined GST if CGST/SGST not listed separately
    if cgst is None and sgst is None:
        igst = extract_labeled_amount(rows, ["IGST", "I.G.S.T", "TOTAL GST", "TOTAL TAX", "GST AMOUNT"], exclude_keywords=["GSTIN"])
        if igst is not None and igst < grand_total:
            cgst = round(igst / 2.0, 2)
            sgst = round(igst - cgst, 2)

    cgst = cgst if (cgst is not None and cgst < grand_total) else 0.0
    sgst = sgst if (sgst is not None and sgst < grand_total) else 0.0

    # Base / Taxable Amount
    base_amount = extract_labeled_amount(
        rows,
        ["TAXABLE VALUE", "TAXABLE AMOUNT", "TAXABLE TOTAL", "SUB TOTAL", "SUBTOTAL", "BASIC AMOUNT", "NET AMOUNT", "ASSESSABLE VALUE"],
        exclude_keywords=["GRAND TOTAL", "NET PAYABLE"]
    )

    if base_amount is None or base_amount > grand_total:
        if grand_total > 0 and (cgst > 0 or sgst > 0):
            base_amount = round(max(grand_total - cgst - sgst, 0.0), 2)
        else:
            base_amount = grand_total

    # If base_amount was found and taxes weren't, infer split GST if there is a clean difference
    if base_amount > 0 and grand_total > base_amount and cgst == 0.0 and sgst == 0.0:
        tax_diff = round(grand_total - base_amount, 2)
        if tax_diff > 0:
            cgst = round(tax_diff / 2.0, 2)
            sgst = round(tax_diff - cgst, 2)

    return base_amount, cgst, sgst, grand_total


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
        vendor_gstin = extract_gstin(full_text)
        base_amount, cgst, sgst, grand_total = extract_tax_and_totals(full_text, merged_rows)

        return {
            "status": "Success",
            "data": {
                "vendorName": vendor_name,
                "billNo": bill_no,
                "billDate": bill_date,
                "vendorGstin": vendor_gstin,
                "baseAmount": float(base_amount),
                "cgst": float(cgst),
                "sgst": float(sgst),
                "amount": float(grand_total),
                "description": f"Auto-extracted via BillStack OCR from {vendor_name}"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)