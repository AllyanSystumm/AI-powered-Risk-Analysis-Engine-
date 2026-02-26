<div align="center">
  <h1>🛡️ AI-Risk Analyzer Engine with Dashboard </h1>
  <p>An AI-powered real-time fraud detection and risk analysis platform for e-commerce.</p>

  [![Next.js](https://img.shields.io/badge/Frontend-Next.js_14-black?logo=next.js)](https://nextjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/CSS-Tailwind-38B2AC?logo=tailwind-css)](#)
  [![NestJS](https://img.shields.io/badge/Backend-NestJS_10-E0234E?logo=nestjs)](https://nestjs.com/)
  [![FastAPI](https://img.shields.io/badge/AI_Engine-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Llama 3](https://img.shields.io/badge/LLM-Llama_3.3_70B-blue)](#)
</div>

---

## 📸 Features

- **Real-time Risk Scoring** — Every order is instantly fully verified by a Llama 3.3 Large Language Model against 8 distinct geographic and historical fraud rules.
- **Geographic IP vs Address Verifier** — Intelligently compares the IP city and country with the physical shipping address and user residency.
- **Historical Context Extraction** — The backend builds context from historical order data, checking phone, address, and email histories.
- **Strict Risk Band Enforcement** — Backend logic ensures scoring constraints (Max Score: 30):
  - `0` → ✅ **Ship** (No Risk)
  - `1–30` → ⚠️ **Manual Review** (Chances of Risk Delivery)
- **Universal Phone Number Input** — Global drop-down country code enforcement (powered by `react-phone-number-input`). Ensures clean `+XX 3XX XXXX` formats.
- **Same Person Detection** — Flags potentially threatening massive order streams from single combinations.

---

## 🏗️ Architecture Stack

RiskGuard uses a split micro-service architecture to separate the UI, Database, and LLM interfaces securely.

```mermaid
graph TD;
    A[Next.js Storefront / Dashboard] -->|REST| B(NestJS Main API);
    B -->|PostgreSQL Schema| C[(Docker DB)];
    B -->|Deep Verify| D[FastAPI AI Service];
    D -->|Inference Call| E([Groq: Llama 3.3 70B]);
```

---

## 📊 Risk Scoring System

The RiskGuard system evaluates each incoming order and assigns a **Risk Score** dynamically scaling from **0 to 30**.

- **Point Allocation**: The system leverages 8 distinct fraud detection rules. Rules #1 and #2 perform informational checks (+0 points). Rules #3 through #8 are actual penalty rules. Each time a penalty rule applies to an order, it receives exactly **+5 risk points**.
- **Score Range**: While an order theoretically triggers multiple rules (6 rules * 5 points = 30 points), the backend strictly limits and **caps the maximum score at 30** to encompass the full scale.
- **Outcome Actions**:
  - **0 points**: The order strictly receives a recommendation to **Ship** (No Risk).
  - **1 to 30 points**: The order receives a recommendation for **Manual Review** (Chances of Risk Delivery).

### 🔍 Unpacking the 8 Fraud Detection Rules

> [!NOTE]
> **How scoring works**: Rules #1 and #2 are informational and always add **0 points**. Rules #3 through #8 are penalty rules that add **+5 points** each when triggered. If an order behaves normally and does **not** trigger any of rules #3 through #8, it receives **0 penalty points** and is automatically marked as **✅ Ship (No Risk)**.

| Rule # | Validation Focus | Weight | Description |
|---|----------------|----------|-------------------|
| **1** | Contact Specificity | +0 | Confirms uniqueness bounds of user email and phone (Passed Check) |
| **2** | Geo-Verify Delivery | +0 | Validates the city string against the LLMs geographic models (Passed Check) |
| **3** | Hurry / Rapid Booking | +5 | Flags rapid successive orders from the identical email addressing bots. **Triggers if ANY of the following are met**: 1) `< 10 mins` since their last order, 2) `> 2 orders` in the last 24 hours, or 3) `> 14 orders` in the last 7 days. |
| **4** | Cross-Account Addresses | +5 | Flags identical physical delivery addresses booked across diverse user accounts |
| **5** | Postal Code Integrity | +5 | **Integrated with ZipcodeStack**. The system queries the ZipcodeStack API with the provided postal code and country to retrieve the true official city and state. The system then prompts the Llama 3 model to cross-reference ZipcodeStack’s official geographic data against the exact city/state strings the customer manually entered in their order to determine if the postal code is mismatched, stolen, or entirely invalid for that region. |
| **6** | Stolen Identity (Email) | +5 | A single email is logged across entirely unrelated identities |
| **7** | Stolen Identity (Phone) | +5 | A single contact number is used by separate entities |
| **8** | Delivery Mismatch | +5 | Explict 'City' field directly contradicts the inline street address format |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18+
- **Python** 3.10+
- **Docker** and Docker Compose (for the DB)
- **Groq API Key** (Avail. free at [console.groq.com](https://console.groq.com))
- **ZipcodeStack API Key** (For rule #5 postal validation. Avail. free at [zipcodestack.com](https://zipcodestack.com/))

### 2. Configure Environment `.env`
Create `.env` inside `backend/ai_service/`:
```env
GROQ_API_KEY=your_groq_api_key_here
ZIPCODESTACK_API_KEY=your_zipcodestack_api_key_here
```

Ensure `backend/main_api/.env` is configured natively:
```env
DATABASE_URL="postgresql://risk_user:risk_password@localhost:5433/risk_analysis"
AI_SERVICE_URL="http://localhost:8000"
```

### 3. Boot Methods

**Option 1: The Magic Script** (Linux/Mac)
```bash
./run_project.sh
```

**Option 2: Manual Start** (Across 3 Terminals)
```bash
# Terminal 1: Database
docker-compose up -d

# Terminal 2: API
cd backend/main_api
npm install
npx prisma db push
npm run start:dev

# Terminal 3: LLM Engine
cd backend/ai_service
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn groq pydantic
python main.py

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing and Payloads

We include a `test_payloads/` directory containing various mock edge-case order scenarios (missing states, wrong countries, duplicate users). 

Submit one manually against the backend:
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d @test_payloads/test_country_mismatch.json
```

---

## 🖥️ Dashboard Map

Visit `http://localhost:3000` to visualize the system.

- **`/` Root Dashboard** — Complete overview table, Filter bounds, Visual progress colors. Click `Details` on an order line item to view the exact Llama 3 logic and triggers.
- **`/store` Live Simulator** — Place dummy orders using the React-Phone input block to actively view the engine dissect user footprints live.

<img width="1822" height="996" alt="Screenshot from 2026-02-26 12-20-20" src="https://github.com/user-attachments/assets/b0d6c808-7bba-491f-8b99-131a46aa0c2e" />
<img width="1822" height="996" alt="Screenshot from 2026-02-26 12-21-32" src="https://github.com/user-attachments/assets/3bdae724-f2bc-4dbf-be75-5d39e8d42adc" />
