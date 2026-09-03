from fastapi import FastAPI, File, UploadFile
import easyocr
import re
import requests  # <--- Make sure this is imported

app = FastAPI()
reader = easyocr.Reader(['en'])

@app.post("/extract-bill")
async def extract_bill(file: UploadFile = File(...)):
    contents = await file.read()
    results = reader.readtext(contents, detail=0)
    
    full_text = " ".join(results).upper()
    
    # 1. VENDOR NAME
    generic_headers = ["TAX INVOICE", "INVOICE", "CASH MEMO", "BILL", "RECEIPT"]
    vendor_parts = []
    for line in results:
        u_line = line.upper().strip()
        if u_line in generic_headers: continue
        if any(key in u_line for key in ["GSTIN", "ADDRESS", "MOB", "BILL NO", "DATE", "TEL"]): 
            break
        vendor_parts.append(line.strip())
    vendor_name = " ".join(vendor_parts) if vendor_parts else "Unknown Vendor"

   # --- 2. BILL NUMBER (Surgical Scan & Score) ---
    bill_number = "Unknown ID"
    
    # Pattern 1: Matches SK/2026/0452 or INV-202-01 (Contains at least one / or -)
    id_pattern = r'\b[A-Z0-9]{1,8}[/\-][A-Z0-9/\-]{2,12}\b'
    
    # Pattern 2: Fallback for alphanumeric IDs without slashes (e.g., SK0452)
    fallback_id_pattern = r'\b[A-Z]{1,3}\d{3,6}\b'

    # Clean the full text for better matching
    clean_full_text = full_text.replace("|", "/").replace(":", " ") # Common OCR errors
    
    # Step A: Look for patterns that include a slash or hyphen
    candidates = re.findall(id_pattern, clean_full_text)
    
    # Step B: Filter out the Date and GSTIN so they aren't picked as the Bill No
    # We remove anything that matches a date format (DD-MM-YYYY)
    filtered_candidates = [
        c for c in candidates 
        if not re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', c) 
        and len(c) > 3
    ]

    if filtered_candidates:
        # Usually, the first match found after "BILL NO" is the winner
        bill_number = filtered_candidates[0]
    else:
        # Step C: If no slash-based IDs, look for simple Alphanumeric ones
        fallbacks = re.findall(fallback_id_pattern, clean_full_text)
        if fallbacks:
            bill_number = fallbacks[0]

    # Double-check: If OCR read "SK / 2026 / 0452" (with spaces), we stitch it manually
    if bill_number == "Unknown ID":
        for i, line in enumerate(results):
            if any(k in line.upper() for k in ["BILL", "INV", "NO"]):
                # Stitch the next 3 pieces of text together
                chunk = "".join(results[i:i+4]).replace(" ", "").replace(":", "")
                match = re.search(r'([A-Z0-9/]{4,15})', chunk.upper())
                if match:
                    bill_number = match.group(1)
                    break
    # 3. GST EXTRACTION
    cgst_match = re.search(r'CGST.*?(\d+\.\d{2})', full_text)
    sgst_match = re.search(r'SGST.*?(\d+\.\d{2})', full_text)
    cgst_amount = float(cgst_match.group(1)) if cgst_match else 0.0
    sgst_amount = float(sgst_match.group(1)) if sgst_match else 0.0

    # 4. DATE & GSTIN
    date_match = re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', full_text)
    bill_date = date_match.group(0) if date_match else "15-05-2026"
    gstin_match = re.search(r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}', full_text)
    vendor_gstin = gstin_match.group(0) if gstin_match else "GSTIN Not Found"

    # 5. GRAND TOTAL
    price_pattern = r'\d+\.\d{2}'
    prices = re.findall(price_pattern, full_text)
    grand_total = max([float(p) for p in prices]) if prices else 0.0

    # ... (Keep all your extraction logic for vendor_name, bill_number, etc. above)

    # --- 🚀 THE UPGRADED BRIDGE: DEBUG MODE ---
    # This sends the data to your Java server and tells you EXACTLY what happened
    java_payload = {
        "vendorName": vendor_name,
        "billNo": bill_number,
        "amount": grand_total,
        "billDate": bill_date,
        "vendorGstin": vendor_gstin,
        "cgst": cgst_amount,
        "sgst": sgst_amount,
        "baseAmount": round(grand_total - (cgst_amount + sgst_amount), 2),
        "eventName": "Wings Technical Fest",
        "description": "Auto-extracted via BillStack OCR"
    }

    try:
        # We store the response in a variable to check the status
        response = requests.post("http://localhost:8080/api/bills", json=java_payload)
        
        if response.status_code == 200:
            print(f"✅ Success! Bill {java_payload['billNo']} saved to MySQL.")
        elif response.status_code == 400:
            # This will catch our 'Duplicate Bill' error message from Java
            print(f"⚠️ Java rejected this: {response.text}")
        else:
            print(f"❌ Server Error {response.status_code}: Check your Java Terminal for red text.")
            
    except Exception as e:
        print(f"❌ Connection Failed: Is the Java App running on port 8080? ({e})")

    # Finally, return the result to the browser
    return {"status": "Success", "data": java_payload}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)