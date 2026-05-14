from fastapi import FastAPI, File, UploadFile
import easyocr
import re

app = FastAPI()
reader = easyocr.Reader(['en'])

@app.post("/extract-bill")
async def extract_bill(file: UploadFile = File(...)):
    contents = await file.read()
    results = reader.readtext(contents, detail=0)
    
    # 1. Join text and normalize to uppercase for keyword matching
    full_text = " ".join(results).upper()
    
    # 2. Strategy: Find all numbers that look like prices (e.g., 590.00)
    # This regex looks for digits followed by a dot and exactly two digits.
    # It will find 590.00 but IGNORE 2026 (the year).
    price_pattern = r'\d+\.\d{2}'
    prices = re.findall(price_pattern, full_text)
    
    amount = 0.0
    
    # 3. Priority logic: Look for the number immediately following "TOTAL"
    if "TOTAL" in full_text:
        # We split by "TOTAL" and look at the text after the LAST occurrence
        parts = full_text.split("TOTAL")
        after_total = parts[-1]
        total_matches = re.findall(price_pattern, after_total)
        if total_matches:
            amount = float(total_matches[0])
            
    # 4. Fallback: If "TOTAL" keyword is missing, take the max of found prices
    if amount == 0.0 and prices:
        amount = max([float(p) for p in prices])

    # Guess Vendor Name (usually the first line detected)
    vendor = results[0] if results else "Unknown Vendor"

    return {
        "vendor_name": vendor,
        "amount": amount,
        "detected_prices": prices # Useful for debugging
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)