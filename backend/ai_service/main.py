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


E164_SYSTEM_PROMPT = """You are a phone number validation and formatting assistant.
Your task is to only accept and output phone numbers in strict E.164 international format.

Rules:
1. A valid phone number must start with a single plus sign '+'.
2. After '+', it must contain only digits.
3. The next 1 to 3 digits must be a valid ITU country calling code.
4. After the country code must follow valid national number digits (area code + subscriber number)
   with no local trunk prefixes (e.g., drop any leading 0 from local numbers).
5. The total number of digits (excluding the '+') must be between 2 and 15.
6. No spaces, hyphens, parentheses, letters, or other symbols are allowed in the output.
7. If the input number is invalid or does not match the E.164 rules, respond exactly with: Invalid phone number

Do not add any additional text or explanation.
Only output a valid E.164 phone number (e.g. +14155552671) or the exact string: Invalid phone number"""


async def normalize_phone_e164(raw_phone: str, country: str) -> str:
    """Pre-process the raw phone input through a dedicated LLM call to
    produce a clean E.164 number before the main fraud analysis."""
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",   # fast, cheap model for this simple task
            messages=[
                {"role": "system", "content": E164_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Phone input: {raw_phone}\n"
                        f"Country: {country}\n"
                        "Convert to E.164 format following all rules above."
                    )
                }
            ],
            temperature=0,
            max_tokens=30,
        )
        normalised = resp.choices[0].message.content.strip()
        # Safety guard: if the model starts explaining instead of just the number, fall back
        if normalised.startswith('+') or normalised == 'Invalid phone number':
            return normalised
        return raw_phone   # unchanged — let Rule 9 handle ambiguous cases
    except Exception:
        return raw_phone   # on any error, pass original value through


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
    phone_number = payload.user_profile.get('phone', 'unknown')

    # --- PRE-PROCESS: Normalise phone to strict E.164 before Rule 9 validation ---
    phone_number = await normalize_phone_e164(phone_number, user_country)

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
   - You are an expert international phone number formatter and validator.
   - Raw input phone: `{phone_number}` | User-selected country: `{user_country}`

   ─────────────────────────────────────────────────────────────────
   STEP 0 — NORMALISE TO E.164 (ALWAYS do this first, before anything else)
   ─────────────────────────────────────────────────────────────────
   E.164 normalisation rules:
     1. Output MUST start with a plus sign (+).
     2. Use the correct country calling code from `user_country` (unless the number already has one).
     3. Strip all spaces, hyphens, dots, parentheses, and other separators from the raw input.
     4. Remove any local trunk / STD prefix (leading '0', '00', or other local dialing prefix) BEFORE adding the country code.
     5. After the '+' there must be ONLY digits — no spaces or separators.
     6. If the number is completely unparseable → triggered: true, explanation: 'Input phone number is invalid or ambiguous.'

   Country calling code reference:
     Pakistan=+92 | India=+91 | US/Canada=+1 | UK=+44 | Australia=+61 | UAE=+971
     Saudi Arabia=+966 | Germany=+49 | France=+33 | Brazil=+55 | China=+86
     Nigeria=+234 | South Africa=+27 | Bangladesh=+880 | Italy=+39 | Japan=+81
     Turkey=+90 | Egypt=+20 | Argentina=+54 | Mexico=+52

   Normalisation examples:
     'input: 0300 1234567  + Pakistan  -> +923001234567'  (strip leading 0, add +92)
     'input: 03001234567   + Pakistan  -> +923001234567'  (strip leading 0, add +92)
     'input: +92 300-123 4567 + Pakistan -> +923001234567' (strip spaces & dashes)
     'input: 00923001234567  + Pakistan  -> +923001234567' (strip 00 trunk prefix)
     'input: 09812345678   + India     -> +919812345678'  (strip leading 0, add +91)
     'input: +44 7911-123 456 + UK     -> +447911123456'  (strip spaces & dashes)
     'input: +916543210    + India     -> +916543210'     (already has code, keep as-is)
     'input: +916543210    + Pakistan  -> +916543210'     (keep as-is; mismatch caught in Step 2)

   After normalisation, use the resulting E.164 number for all further steps.

   ─────────────────────────────────────────────────────────────────
   STEP 1 — DETECT COUNTRY CODE from the normalised E.164 number
   ─────────────────────────────────────────────────────────────────
   Extract calling-code prefix from the normalised number:
     +92=Pakistan | +91=India | +1=US/Canada | +44=UK | +61=Australia
     +971=UAE | +966=Saudi Arabia | +49=Germany | +33=France | +55=Brazil
     +86=China | +234=Nigeria | +27=South Africa | +880=Bangladesh
     +39=Italy | +81=Japan | +90=Turkey | +20=Egypt | +54=Argentina | +52=Mexico

   ─────────────────────────────────────────────────────────────────
   STEP 2 — COUNTRY CODE MISMATCH CHECK
   ─────────────────────────────────────────────────────────────────
   If the detected country code does NOT match `user_country` -> triggered: true (+5 pts).
   Explanation: 'Phone number country code (+XX) indicates [Detected Country] but user selected {user_country}.'

   ─────────────────────────────────────────────────────────────────
   STEP 3 — NATIONAL FORMAT VALIDATION (only when Step 2 passes)
   ─────────────────────────────────────────────────────────────────
   Count the digits AFTER the country code prefix in the normalised E.164 number.

   Country       | Code | Digits after code | First digit rule
   --------------|------|-------------------|---------------------------------
   Pakistan      | +92  | EXACTLY 10        | MUST start with 3 — then apply Step 3b
   India         | +91  | EXACTLY 10        | MUST start with 6, 7, 8, or 9
   US / Canada   | +1   | EXACTLY 10        | No restriction
   UK            | +44  | 9 or 10           | Mobile: starts with 7
   Australia     | +61  | EXACTLY 9         | Mobile: starts with 4
   Saudi Arabia  | +966 | EXACTLY 9         | Mobile: starts with 5
   Bangladesh    | +880 | EXACTLY 10        | Mobile: starts with 1
   Nigeria       | +234 | EXACTLY 10        | No restriction
   South Africa  | +27  | EXACTLY 9         | No restriction
   China         | +86  | EXACTLY 11        | Mobile prefix 130-199
   Brazil        | +55  | 10 or 11          | No restriction

   - E.164 total length (country code digits + national digits) must NEVER exceed 15.
   - IF digit count OR starting digit fails -> triggered: true (+5 pts).
   - IF all checks pass -> proceed to Step 3b for Pakistan numbers.

   ─────────────────────────────────────────────────────────────────
   STEP 3b — PAKISTAN OPERATOR PREFIX CHECK (only for Pakistan numbers)
   ─────────────────────────────────────────────────────────────────
   After confirming 10 digits starting with 3, extract the 3-digit operator prefix
   (digits 1-3 of the national number, i.e. characters at positions 3-5 of the E.164 number after +92).

   VALID PTA-assigned operator prefixes ONLY:

   Operator  | Valid prefixes
   ----------|-------------------------------------------------------
   Jazz      | 300, 301, 302, 303, 304, 305, 306, 307, 308, 309,
             | 320, 321, 322, 323, 324, 325
   Zong      | 310, 311, 312, 313, 314, 315, 316, 317, 318, 319,
             | 370, 371
   Ufone     | 330, 331, 332, 333, 334, 335, 336, 337, 338, 339
   Telenor   | 340, 341, 342, 343, 344, 345, 346, 347, 348
   SCOM      | 355  (Azad Jammu & Kashmir / Gilgit-Baltistan only)

   ALL other 3-digit prefixes starting with 3 are NOT assigned
   by PTA and are therefore INVALID (e.g. 326, 327, 328, 329,
   349, 350, 351, 352, 353, 354, 356, 357, 358, 359,
   360-369, 372-379, 380-399).

   IF the 3-digit prefix is NOT in the valid list above:
     -> triggered: true (+5 pts)
     -> explanation: 'The prefix +92 [XXX] is not a valid PTA-assigned Pakistani mobile operator prefix.
        Valid prefixes: Jazz 300-309/320-325, Zong 310-319/370-371,
        Ufone 330-339, Telenor 340-348, SCOM 355.'
   IF the prefix IS in the valid list:
     -> triggered: false (number is fully valid).

   ─────────────────────────────────────────────────────────────────
   WORKED EXAMPLES
   ─────────────────────────────────────────────────────────────────

   Ex 1 — Local format with leading zero (Pakistan — Jazz):
     Input: '03012345678', country=Pakistan
     Step 0: Strip leading 0 -> '3012345678'; add +92 -> normalised: +923012345678
     Step 1: Code = +92 -> Pakistan  |  Step 2: Matches user_country [OK]
     Step 3: National = '3012345678' -> 10 digits, starts with 3 [OK]
     Step 3b: Prefix = '301' -> Jazz [OK]
     Result: triggered=false, explanation='Normalised to +923012345678. Valid Jazz (Pakistan) mobile.'

   Ex 2 — Incomplete number (too few digits):
     Input: '+9233', country=Pakistan
     Step 0: Already E.164-prefixed -> normalised: +9233
     Step 1: Code = +92 -> Pakistan  |  Step 2: Matches [OK]
     Step 3: National = '33' -> only 2 digits; MUST be 10 [FAIL]
     Result: triggered=true (+5 pts), explanation='Pakistani mobile numbers must be exactly 10 digits after +92, but only 2 digits found after the country code.'

   Ex 3 — Spaces and dashes (UK):
     Input: '+44 7911-123 456', country=UK
     Step 0: Strip separators -> normalised: +447911123456
     Step 1: Code = +44 -> UK  |  Step 2: Matches [OK]
     Step 3: National = '7911123456' -> 10 digits, starts with 7 [OK]
     Result: triggered=false, explanation='Normalised to +447911123456. Valid UK mobile.'

   Ex 4 — Country code mismatch:
     Input: '+916543210', country=Pakistan
     Step 0: Already E.164 -> normalised: +916543210
     Step 1: Code = +91 -> India  |  Step 2: Does NOT match Pakistan [FAIL]
     Result: triggered=true (+5 pts), explanation='Country code +91 indicates India, but user selected Pakistan. Country code mismatch.'

   Ex 5 — Valid Ufone number:
     Input: '03311234567', country=Pakistan
     Step 0: Strip leading 0 -> '3311234567'; add +92 -> normalised: +923311234567
     Step 1: Code = +92 -> Pakistan  |  Step 2: Matches [OK]
     Step 3: National = '3311234567' -> 10 digits, starts with 3 [OK]
     Step 3b: Prefix = '331' -> Ufone [OK]
     Result: triggered=false, explanation='Normalised to +923311234567. Valid Ufone (Pakistan) mobile.'

   Ex 6 — Invalid operator prefix (not PTA-assigned):
     Input: '03981234567', country=Pakistan
     Step 0: Strip leading 0 -> '3981234567'; add +92 -> normalised: +923981234567
     Step 1: Code = +92 -> Pakistan  |  Step 2: Matches [OK]
     Step 3: National = '3981234567' -> 10 digits, starts with 3 [OK]
     Step 3b: Prefix = '398' -> NOT in any valid PTA list [FAIL]
     Result: triggered=true (+5 pts), explanation='The prefix +92398 is not a valid PTA-assigned Pakistani mobile operator prefix. Valid prefixes: Jazz 300-309/320-325, Zong 310-319/370-371, Ufone 330-339, Telenor 340-348, SCOM 355.'

   Ex 7 — Valid Telenor with spaces:
     Input: '0345 123 4567', country=Pakistan
     Step 0: Strip spaces & leading 0 -> '3451234567'; add +92 -> normalised: +923451234567
     Step 1: Code = +92 -> Pakistan  |  Step 2: Matches [OK]
     Step 3: National = '3451234567' -> 10 digits, starts with 3 [OK]
     Step 3b: Prefix = '345' -> Telenor [OK]
     Result: triggered=false, explanation='Normalised to +923451234567. Valid Telenor (Pakistan) mobile.'

   ─────────────────────────────────────────────────────────────────
   DECISION:
   - ANY failure in Steps 0, 2, 3, or 3b -> triggered: true (+5 pts).
   - ALL steps pass -> triggered: false, +0 pts.

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
