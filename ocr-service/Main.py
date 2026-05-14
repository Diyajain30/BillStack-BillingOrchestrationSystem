from fastapi import FastAPI, File, UploadFile
import easyocr
import re

app = FastAPI()
reader = easyocr.Reader(['en'])

@app.post("/extract-bill")
async def extract_bill(file: UploadFile = File(...)):
    contents = await file.read()
    results = reader.readtext(contents, detail=0)
    
    # join text for keyword searching
    full_text = " ".join(results).upper()
    
    # --- 1. VENDOR NAME (Multi-line reconstruction) ---
    generic_headers = ["TAX INVOICE", "INVOICE", "CASH MEMO", "BILL", "RECEIPT"]
    vendor_parts = []
    for line in results:
        u_line = line.upper().strip()
        if u_line in generic_headers: continue
        if any(key in u_line for key in ["GSTIN", "ADDRESS", "MOB", "BILL NO", "DATE", "TEL"]): 
            break
        vendor_parts.append(line.strip())
    vendor_name = " ".join(vendor_parts) if vendor_parts else "Unknown Vendor"

    # --- 2. BILL NUMBER (Precision Extraction) ---
    # Fix: \b ensures we match the WHOLE word (don't match 'INV' inside 'INVOICE')
    # Fix: We look for a separator like : or # to ignore titles like "TAX INVOICE"
    bill_no_candidates = re.findall(r'\b(?:BILL|INV|INVOICE|VOUCHER|NO|VCH)[.\s]*[NO|#]*[:\s]+([A-Z0-9\/\-]+)', full_text)
    
    bill_number = "Unknown ID"
    if bill_no_candidates:
        # We pick the longest candidate that isn't just a single character
        # (This helps ignore noise and catch IDs like SK/2026/0452)
        candidates = [c for c in bill_no_candidates if len(c) > 1]
        bill_number = candidates[0] if candidates else "Unknown ID"
    
    # Fallback: if the above fails, look for the first alphanumeric string near 'DATE'
    if bill_number == "Unknown ID" or bill_number == "OICE":
        # Look for "Bill No" pattern more aggressively
        pattern = r'(?:BILL|INV|NO)[:\s#]+([A-Z0-9\/\-]+)'
        match = re.search(pattern, full_text)
        if match:
            bill_number = match.group(1)

    # --- 3. SPECIFIC GST EXTRACTION (CGST & SGST) ---
    # We look for the keyword, skip any text/pipes/percentages, and find the first price
    cgst_match = re.search(r'CGST.*?(?:\d+\.?\d*%)?.*?(\d+\.\d{2})', full_text)
    sgst_match = re.search(r'SGST.*?(?:\d+\.?\d*%)?.*?(\d+\.\d{2})', full_text)
    
    cgst_amount = float(cgst_match.group(1)) if cgst_match else 0.0
    sgst_amount = float(sgst_match.group(1)) if sgst_match else 0.0

    # --- 4. DATE & GSTIN ---
    date_pattern = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'
    date_match = re.search(date_pattern, full_text)
    bill_date = date_match.group(0) if date_match else "Date Not Found"

    gstin_pattern = r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}'
    gstin_match = re.search(gstin_pattern, full_text)
    vendor_gstin = gstin_match.group(0) if gstin_match else "GSTIN Not Found"

    # --- 5. GRAND TOTAL ---
    price_pattern = r'\d+\.\d{2}'
    prices = re.findall(price_pattern, full_text)
    grand_total = 0.0
    if "TOTAL" in full_text:
        parts = full_text.split("TOTAL")
        total_matches = re.findall(price_pattern, parts[-1])
        if total_matches: grand_total = float(total_matches[0])
    if grand_total == 0.0 and prices:
        grand_total = max([float(p) for p in prices])

    return {
        "vendor_info": {
            "name": vendor_name,
            "gstin": vendor_gstin
        },
        "bill_details": {
            "bill_no": bill_number,
            "date": bill_date
        },
        "tax_breakup": {
            "cgst": cgst_amount,
            "sgst": sgst_amount,
            "total_tax": round(cgst_amount + sgst_amount, 2)
        },
        "amount_summary": {
            "grand_total": grand_total,
            "base_amount": round(grand_total - (cgst_amount + sgst_amount), 2)
        },
        "status": "Success"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)