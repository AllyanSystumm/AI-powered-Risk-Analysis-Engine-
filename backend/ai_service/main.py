from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import os
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Risk Analysis AI Service")

# Setup Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

class OrderPayload(BaseModel):
    user_profile: Dict[str, Any]
    order_details: Dict[str, Any]
    address: Dict[str, Any]
    ip_info: Dict[str, Any]
    history: Dict[str, Any]
    historical_context: Optional[Dict[str, Any]] = None

@app.post("/api/v1/analyze")
async def analyze_risk(payload: OrderPayload):
    # Build historical context section for the prompt
    hist_ctx = ""
    if payload.historical_context:
        hc = payload.historical_context

        # Same person order history
        sp = hc.get('same_person_orders', {})
        orders_last_24h = sp.get('orders_last_24h', 0)
        orders_last_7d = sp.get('orders_last_7d', 0)
        total_past = sp.get('total_past_orders', 0)
        last_ts = sp.get('last_order_timestamp', None)
        mins_since_last = sp.get('minutes_since_last_order', None)

        # Address history
        addr_hist = hc.get('address_history', {})
        other_names = addr_hist.get('other_names_at_this_address', [])

        # Duplicate email matches
        dup_email = hc.get('duplicate_email_matches', [])
        if dup_email:
            dup_email_str = "\n".join([
                f"  - Name: {m.get('name')}, Email: {m.get('email')}, Phone: {m.get('phone')}"
                for m in dup_email
            ])
        else:
            dup_email_str = "  None found — this email is unique in the database."

        # Duplicate phone matches
        dup_phone = hc.get('duplicate_phone_matches', [])
        if dup_phone:
            dup_phone_str = "\n".join([
                f"  - Name: {m.get('name')}, Email: {m.get('email')}, Phone: {m.get('phone')}"
                for m in dup_phone
            ])
        else:
            dup_phone_str = "  None found — this phone number is unique in the database."

        hist_ctx = f"""
### DATABASE HISTORICAL CONTEXT (real data from PostgreSQL)
Use this data to evaluate the rules below. These are FACTS — do not hallucinate or invent data.

**Same Person Order History (email: {sp.get('email', 'unknown')}, name: {sp.get('full_name', 'unknown')}):**
- Total past orders by this email: {total_past}
- Orders in last 24 hours: {orders_last_24h}
- Orders in last 7 days: {orders_last_7d}
- Last order timestamp: {last_ts if last_ts else 'No previous orders'}
- Minutes since last order: {mins_since_last if mins_since_last is not None else 'N/A — first order'}

**Delivery Address History (for: {payload.address.get('street', '')}, {payload.address.get('city', '')}):**
- Other customers (different email) who ordered to this exact address: {other_names if other_names else '[]'}

**Duplicate Email Check (same email, different person name in DB):**
{dup_email_str}

**Duplicate Phone Check (same phone, different person name in DB):**
{dup_phone_str}
"""

    # Build explicit geographic comparison fields
    ip_city = payload.ip_info.get('ip_city', 'unknown')
    ip_country = payload.ip_info.get('ip_country', 'unknown')
    addr_street = payload.address.get('street', 'unknown')
    addr_city = payload.address.get('city', 'unknown')
    user_country = payload.user_profile.get('country', 'unknown')
    postal_code = payload.address.get('postal_code', '')

    # --- CHECK 1: City geo-verification (ZipcodeStack -> Nominatim Fallback) ---
    city_data_str = "City verification pending."
    city_verified = False
    try:
        import httpx
        headers = {"User-Agent": "RiskGuard-Fraud-Detection-System/1.0"}
        async with httpx.AsyncClient(headers=headers) as client_geo:
            # Try ZipcodeStack first
            zip_city_resp = await client_geo.get(
                f"https://api.zipcodestack.com/v1/search?apikey=zip_live_Quw1FSmI0uSvINXqdv0yvSCklfcAjbTG9U3adZ4f&city={addr_city}&country={user_country}"
            )
            if zip_city_resp.status_code == 200:
                zip_city_data = zip_city_resp.json()
                if zip_city_data.get("results"):
                    city_data_str = f"VERIFIED (ZipcodeStack): City '{addr_city}' exists in '{user_country}'."
                    city_verified = True
            
            # If ZipcodeStack fails, fallback to Nominatim (OpenStreetMap)
            if not city_verified:
                osm_resp = await client_geo.get(
                    f"https://nominatim.openstreetmap.org/search?city={addr_city}&country={user_country}&format=json&limit=1"
                )
                if osm_resp.status_code == 200 and osm_resp.json():
                    osm_data = osm_resp.json()[0]
                    city_data_str = f"VERIFIED (Nominatim/OSM): City '{addr_city}' was found. Details: {osm_data.get('display_name')}"
                    city_verified = True
                else:
                    city_data_str = f"NOT FOUND: City '{addr_city}' was not found in geo databases for country '{user_country}'. LLM MUST VERIFY IF THIS IS A REAL CITY."
    except Exception as e:
        city_data_str = f"Geo-verification error: {str(e)}"

    # --- CHECK 2: Postal code validation ---
    zip_data_str = "No postal code provided."
    if postal_code:
        try:
            import httpx
            async with httpx.AsyncClient() as ac:
                resp = await ac.get(
                    f"https://api.zipcodestack.com/v1/search?apikey=zip_live_Quw1FSmI0uSvINXqdv0yvSCklfcAjbTG9U3adZ4f&codes={postal_code}&country={user_country}"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", {})
                    if postal_code in results and len(results[postal_code]) > 0:
                        pc_data = results[postal_code][0]
                        zc_city = pc_data.get("city", "Unknown")
                        zc_state = pc_data.get("state", "Unknown")
                        zc_country = pc_data.get("country_code", "Unknown")
                        
                        zip_data_str = f"API DATA FOUND: Postal code '{postal_code}' strictly belongs to City: '{zc_city}', State/Province: '{zc_state}', Country: '{zc_country}' according to ZipcodeStack API."
                    else:
                        zip_data_str = f"API DATA NOT FOUND: Postal code '{postal_code}' not found in ZipcodeStack for '{user_country}'. The LLM MUST use its internal knowledge to verify if this postal code matches the city, state, and country."
                else:
                    zip_data_str = f"API ERROR ({resp.status_code}). Fallback to LLM internal knowledge verification."
        except Exception as e:
            zip_data_str = f"Postal API error: {str(e)}. Fallback to LLM internal knowledge verification."

    geo_comparison = f"""
### GEOGRAPHIC LOCATION COMPARISON
| Field                 | Value                                              |
|-----------------------|----------------------------------------------------|
| IP City               | {ip_city}                                          |
| IP Province           | {payload.ip_info.get('ip_region', 'unknown')}      |
| Delivery City         | {addr_city}                                        |
| Delivery State/Prov   | {payload.address.get('state', 'unknown')}          |
| Delivery Postal Code  | {postal_code}                                      |
| Delivery Country      | {user_country}                                     |

---
### GEO-VERIFICATION RESULTS
- **City Lookup:** {city_data_str}
- **Postal Code Lookup:** {zip_data_str}

### CRITICAL GEO-RISK INSTRUCTIONS (Rules 5 & 6):
1. **Rule #5 (City Verification):**
   - If city lookup says VERIFIED (ZipcodeStack or Nominatim) → Rule #5 triggered: false.
   - If city lookup says NOT FOUND → USE YOUR (LLM) KNOWLEDGE. If '{addr_city}' is a real city in '{user_country}' (e.g., Faisalabad in Pakistan), Rule #5 should be TRIGGERED: FALSE. Only trigger if the city is clearly fake or in the wrong country.
   
2. **Rule #6 (Postal Code Verification):**
   - **Scenario 1 - API DATA FOUND:** Compare the ZipcodeStack API's City, State, and Country against the delivery address CASE-INSENSITIVELY (ignore letter casing, e.g., 'punjab' == 'Punjab', 'lahore' == 'Lahore'). Also accept common abbreviations ('PK' == 'Pakistan', 'PB' == 'Punjab').
     - If all three match (case-insensitive, accounting for abbreviations): Rule #6 triggered: false. Explanation must say: "The postal code '{postal_code}' is confirmed to match city '{addr_city}', state '{payload.address.get('state', 'unknown')}', and country '{user_country}' — verified by ZipcodeStack API."
     - If City and Country match but State mismatches: USE YOUR KNOWLEDGE. You have the flexibility to accept it if the postal code is logically related to the known correct state or if it's a known formatting issue. In this case, Rule #6 triggered: false.
     - If the postal code is TOTALLY OPPOSITE to the provided city '{addr_city}', state '{payload.address.get('state', 'unknown')}', and country '{user_country}': Rule #6 triggered: true. Add a severe explanation highlighting the total mismatch.
   - **Scenario 2 - API DATA NOT FOUND or API ERROR:** Use internal AI knowledge. Check:
     1. Is the city '{addr_city}' actually in the state '{payload.address.get('state', 'unknown')}'?
     2. Is the city '{addr_city}' actually in country '{user_country}'?
     3. Is postal code '{postal_code}' valid for '{addr_city}'?
     - Comparisons MUST be case-insensitive. Minor caps differences ('punjab' vs 'Punjab') are NOT mismatches.
     - Be FLEXIBLE: If postal doesn't match the state perfectly based on API but matches via your knowledge base, accept it.
     - If the postal code is TOTALLY OPPOSITE/WRONG for the given country/state/city based on your knowledge: Rule #6 triggered: true. Specify the exact mismatch.
"""

    # Serialize order data without historical_context to avoid sending it twice
    order_data_json = payload.model_dump_json(exclude={"historical_context"})

    prompt = f"""
You are an enterprise-grade Fraud Detection and Risk Scoring assistant.

Your job is to analyze incoming e-commerce orders and produce a structured, precise JSON result.

### INPUT DATA
{order_data_json}

{hist_ctx}

{geo_comparison}

### OUTPUT JSON FORMAT (MANDATORY)
Your output MUST be valid JSON only, NOTHING else.

Provide exactly these fields:
{{
"order_id": "<string>",
"risk_score": <number 0-30>,
"risk_flags": [
{{
"rule_id": <number>,
"rule_name": "<string>",
"triggered": <boolean>,
"confidence": <0-1 float>,
"explanation": "<string>"
}}
],
"recommended_action": "<ship | manual_review>",
"verification_suggestions": [
"<string>"
],
"summary": "<string concise summary>"
}}

### RISK SCORING RULES (9 rules total)
You MUST evaluate ALL 9 rules and include ALL 9 in the `risk_flags` array.

--- PASSED CHECKS (informational, always triggered: false, +0 points) ---

1. Specific Email and Phone: +0 (PASSED CHECK — always triggered: false)
   - This confirms: one customer = one unique email + one unique phone.
   - Explanation: "This customer has a specific email and phone number associated with their account."

2. Delivery City Verification: +0 (PASSED CHECK — always triggered: false)
   - USE the GEO-VERIFICATION RESULTS above. Compare CASE-INSENSITIVELY.
   - If city is verified by API or LLM knowledge -> triggered: false. Specify the source.
   - If city is NOT found -> USE YOUR KNOWLEDGE. If '{addr_city}' is a real city in '{user_country}', then triggered: false.
   - Only fail this check if the city is CLEARLY FAKE or in the WRONG COUNTRY.

--- RISK RULES (triggered: true adds score) ---

3. Hurry Order Booking: +5 (USE `same_person_orders` data from DATABASE)
   - This rule checks if the same person (same email) is ordering too fast.
   - Check these THREE conditions (ANY one triggers the rule):
     a) Minutes since last order < 10 (too fast — must wait at least 10 minutes between orders)
     b) Orders in last 24 hours > 2 (maximum 2 orders per 24 hours)
     c) Orders in last 7 days > 14 (maximum 14 orders per 7 days)
   - IF `minutes_since_last_order` is null or 'N/A' -> this is the first order, triggered: false.
   - IF any of conditions a/b/c is true -> triggered: true. Explain which condition failed.
   - IF all conditions are within limits -> triggered: false. State the actual values.

4. Different Name with Same Address: +5 (USE `address_history.other_names_at_this_address` from DATABASE)
   - Check if a DIFFERENT-named customer has previously ordered to the same delivery address.
   - IF the list is NOT empty -> triggered: true. Name the other customer(s).
   - IF the list IS empty -> triggered: false. Say: "No other customers have ordered to this address."
   - NOTE: Multiple customers at the same address is allowed — this is just a mild flag for awareness.

5. Postal Code Validation: +5 (USE GEO-VERIFICATION RESULTS)
   - Evaluate the postal code using the API result or LLM knowledge.
   - MANDATORY COUNTRY CHECK: First, compare the provided country against the API/LLM country for this postal code. If they do NOT match, Rule 5 is triggered: true (+5 pts).
   - OPTIONAL STATE/PROVINCE CHECK: 
     - If the user explicitly provided a state/province (not blank/unknown/None), compare it to the API/LLM state. If there is a clear mismatch, Rule 5 is triggered: true (+5 pts).
     - If the user left the state/province blank (or it is unknown), DO NOT assign any risk for the missing state. Skip the state check entirely!
   - PASSED CHECK EXCEPTION: If the API data is missing/mismatched but your internal LLM knowledge confirms the postal code matches the city AND the country matches, THIS IS A PASSED CHECK. Set `triggered: false`.
   - Treat Rule 5 as a single single rule that maxes at +5 pts if ANY of the above mismatches occur.
   - IF country or explicit-state mismatches -> triggered: true (+5 pts). State the reason.
   - IF country matches AND (explicit state matches OR state was left blank) -> triggered: false.

6. Duplicate Email — Different Identity: +5 (USE `duplicate_email_matches` from DATABASE)
   - MUST check the `duplicate_email_matches` list from the database.
   - IF the list is NOT empty -> triggered: true. Name the other person using this email.
   - IF the list IS empty -> triggered: false. Say: "This email is unique — no other person uses it."
   - NEVER invent names. Only use names from the database list.

7. Duplicate Phone — Different Identity: +5 (USE `duplicate_phone_matches` from DATABASE)
   - MUST check the `duplicate_phone_matches` list from the database.
   - IF the list is NOT empty -> triggered: true. Name the other person using this phone.
   - IF the list IS empty -> triggered: false. Say: "This phone number is unique — no other person uses it."
   - NEVER invent names. Only use names from the database list.

8. City Name Mismatch (Delivery Address vs City Box): +5
   - Compare the city explicitly entered in the 'City' field (`{addr_city}`) with the actual text inside the 'Delivery Address' (`{addr_street}`).
   - Very often, users type their street address AND their city in the 'Delivery Address' box (e.g. '8998 b - Block, Military Account, lahore').
   - If the text in the Delivery Address clearly indicates a DIFFERENT city than the one in the City box (e.g., Address says 'lahore', but City says 'peshawar'):
     - Rule #8 triggered: true (+5 pts).
     - Explanation MUST dynamically detail both cities: "City name is not matched. Delivery address implies city is [City from Address], but the explicitly provided city is {addr_city}."
   - If they match, or if the Delivery Address doesn't explicitly mention a conflicting city:
     - Rule #8 triggered: false. Say: "City implicitly matches or no contradictory city found in the delivery address."

9. Incorrect Phone Number Pattern: +5 
   - You are an expert phone number parser and validator that understands international numbering rules (E.164 + national formats).
   - Use the `user_country` ({user_country}) and the provided phone number.
   - COUNTRY CODE AUTO-INSERT: Mentally prepend the correct country calling code based on the selected country (e.g., US -> +1, India -> +91, Pakistan -> +92, UK -> +44, Australia -> +61, Brazil -> +55).
   - FORMAT VALIDATION: Validate the rest of the number after the country code based on national formats.
     - Pakistan (+92): Mobile must be 10 digits after +92 starting with 3. If +92 isn't present, raw input should be 11 digits with leading zero.
     - India (+91): Exactly 10 digits after +91, starting with 6,7,8,9.
     - US/Canada (+1): 10 digits after +1 (3-digit area + 7-digit subscriber).
     - UK (+44): Up to 10 digits after +44; mobile typically begins with 7.
     - Australia (+61): 9 digits after +61, mobile typically starts with 4.
     - Brazil (+55): Area code (2 digits) + subscriber (8-9 digits).
     - China (+86): 11 digits after +86, first three 130-199.
     - Saudi Arabia (+966): Usually 9 digits after +966.
     - South Africa (+27): Typically 9 digits.
     - Nigeria (+234): Typically 10 digits.
     - Bangladesh (+880): Typically 10 digits, mobile starts with 1.
     - Others (Argentina +54, Mexico +52, Germany +49, France +33, Italy +39, Japan +81): Standard local numbering length.
   - The full number must never exceed 15 digits total.
   - IF the phone number format is WRONG (incorrect digits, wrong starting digit, invalid structure) -> triggered: true (+5 pts). State: "Number does not match the valid phone number pattern for {user_country}."
   - IF the phone number format is VALID -> triggered: false. Optional: provide the E.164 formatted number in your explanation.

### RISK BAND RULES (NEVER deviate):
- If total risk score is EXACTLY 0 -> recommended_action MUST be "ship" (No Risk)
- If total risk score is 1 to 30 -> recommended_action MUST be "manual_review" (Chances of Risk Delivery)

### CRITICAL INSTRUCTIONS:
1. You MUST include ALL 9 rules in the `risk_flags` array.
2. The `risk_score` MUST be the exact sum of weights of triggered rules (each triggered risk rule = +5), but CAPPED at a maximum of 30.
3. If 0 risk rules triggered -> risk_score = 0, action = "ship".
4. NEVER hallucinate or invent data. Only use what is in the DATABASE CONTEXT and INPUT DATA.
5. For Rule 3 (Hurry Order Booking): if minutes_since_last_order is null, it is a FIRST ORDER — do NOT trigger.
6. For Rules 6 and 7: if the database list says "None found", the rule MUST be triggered: false.
7. SUMMARY: Write 2-3 sentences describing what was found and the recommended action.
"""


    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a fraud detection JSON API. Output strictly JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        return completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
