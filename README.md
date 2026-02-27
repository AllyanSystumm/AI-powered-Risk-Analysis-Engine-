<div align="center">
  <h1>🛡️ RiskGuard: AI-Powered Risk Analysis Engine</h1>
  <p><strong>Real-time fraud detection and risk analysis platform for modern e-commerce.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Frontend-Next.js_15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Backend-NestJS_11-E0234E?style=for-the-badge&logo=nestjs" alt="NestJS" />
    <img src="https://img.shields.io/badge/AI_Engine-FastAPI-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
    <img src="https://img.shields.io/badge/LLM-Llama_3.3_70B-blue?style=for-the-badge" alt="Llama 3.3" />
    <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  </p>
</div>

---

## 🌟 Overview

RiskGuard is a state-of-the-art fraud detection system designed to protect e-commerce platforms from malicious activities. By leveraging the power of Large Language Models (LLMs) and real-time data analysis, it provides accurate risk scoring for every order, enabling merchants to make informed decisions.

## 🚀 Key Features

*   **⚡ Real-time Risk Scoring:** Instant verification of orders against 10 sophisticated fraud detection rules using Llama 3.3.
*   **🌍 Geolocation Intelligence:** Cross-references IP addresses with shipping and residency data to detect inconsistencies.
*   **🏠 AI-Powered Address Validation:** Uses Llama 3.1 to validate delivery addresses, ensuring they are genuine and logically sound.
*   **📚 Historical Context:** Analyzes historical order data (phone, email, address) to identify recurring patterns of fraud.
*   **⚖️ Dynamic Risk Bands:** Implements a strict scoring system (0-40) with automated recommendations (Ship vs. Manual Review).
*   **📱 Secure Phone Input:** Integrated international phone number validation with country code matching.
*   **📊 Interactive Dashboard:** A comprehensive UI to visualize risk trends, order details, and real-time analysis logs.

---

## 🏗️ Technical Architecture

RiskGuard follows a robust microservices architecture to ensure scalability and security.

```mermaid
graph TD;
    A[Next.js Storefront / Dashboard] -->|REST API| B(NestJS Main API);
    B -->|Prisma ORM| C[(PostgreSQL)];
    B -->|FastAPI Client| D[FastAPI AI Service];
    D -->|Inference| E([Groq: Llama 3.3 70B]);
    D -->|Address Check| F([Groq: Llama 3.1 8B]);
```

### Tech Stack
*   **Frontend:** Next.js 15, Tailwind CSS, Recharts
*   **Backend (API):** NestJS, Prisma ORM, PostgreSQL
*   **AI Service:** FastAPI, Python, Groq SDK
*   **Infrastructure:** Docker, Docker Compose

---

## 🛠️ Installation & Setup

### 1. Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   Docker & Docker Compose
*   [Groq API Key](https://console.groq.com)
*   [ZipcodeStack API Key](https://zipcodestack.com/)

### 2. Environment Configuration

#### AI Service (`backend/ai_service/.env`)
```env
GROQ_API_KEY=your_groq_api_key_here
```

#### Main API (`backend/main_api/.env`)
```env
DATABASE_URL="postgresql://risk_user:risk_password@localhost:5433/risk_analysis"
AI_SERVICE_URL="http://localhost:8000"
```

### 3. Running the Project

#### 🪄 Automated Start (Recommended)
```bash
chmod +x run_project.sh
./run_project.sh
```

#### 🛠️ Manual Start

**Step 1: Database**
```bash
docker-compose up -d
```

**Step 2: Main API**
```bash
cd backend/main_api
npm install
npx prisma db push
npm run start:dev
```

**Step 3: AI Service**
```bash
cd backend/ai_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt # or install manually
uvicorn main:app --port 8000 --reload
```

**Step 4: Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## 📈 Risk Scoring & Decision Logic

RiskGuard uses a deterministic scoring model combined with AI-powered checks to evaluate order safety.

### ⚖️ Scoring Tiers
Every order is assigned a final **Risk Score** between **0 and 40**, which dictates the system's recommendation:

*   **0 Points** → ✅ **Ship (No Risk)**: The order passed all penalty checks. Automated fulfillment is recommended.
*   **1–40 Points** → ⚠️ **Manual Review**: One or more risk factors were detected. Human intervention is required to verify the customer's intent.

---

### 🔍 How Points are Allocated

The engine evaluates **10 distinct rules**. These are categorized into **Informational Checks** and **Penalty Rules**.

#### 1. Informational Checks (0 Points)
These rules are used to gather context or verify basic data points. They **never** increase the risk score, even if they fail.
*   **Rule #1: Contact Specificity** — Ensures the email and phone are unique to this transaction.
*   **Rule #2: City Verification** — AI confirms the city exists within the stated country.

#### 2. Penalty Rules (+5 Points Each)
These rules represent specific fraud indicators. Every time a penalty rule is triggered, **exactly 5 points** are added to the total score.
*   **Rule #3: Hurry Order** — Flags rapid-fire orders (e.g., 3 orders in 10 minutes) from the same email.
*   **Rule #4: Address Reuse** — Flags when multiple different names use the exact same delivery address.
*   **Rule #5: Postal Validation** — Checks if the ZIP/Postal code actually matches the City/State via ZipcodeStack API.
*   **Rule #6: Email Identity Mismatch** — Flags if an email associated with "John Doe" is suddenly used by "Jane Smith".
*   **Rule #7: Phone Identity Mismatch** — Flags if a phone number is shared across unrelated user accounts.
*   **Rule #8: City/Address Conflict** — Flags when the 'City' field doesn't match the city mentioned in the 'Street Address'.
*   **Rule #9: Phone/Country Mismatch** — Validates that the phone's country code (e.g., +44) matches the shipping country (e.g., United Kingdom).
*   **Rule #10: AI Address Logic** — Llama 3.1 analyzes the address string to detect "fake" or "keyboard mash" addresses (e.g., "asdf 123 lane").

---

### 📊 Rule Summary Table

| # | Rule Name | Category | Points | Trigger Condition |
|---|---|---|---|---|
| 1 | Contact Specificity | Informational | +0 | Always 0 (Data collection) |
| 2 | City Verification | Informational | +0 | Always 0 (Data collection) |
| 3 | Hurry Order | Penalty | **+5** | >2 orders/day or <10m gap |
| 4 | Address Reuse | Penalty | **+5** | Same address, Different Name |
| 5 | Postal Validation | Penalty | **+5** | ZIP/City mismatch |
| 6 | Email Mismatch | Penalty | **+5** | Same Email, Different Identity |
| 7 | Phone Mismatch | Penalty | **+5** | Same Phone, Different Identity |
| 8 | City Conflict | Penalty | **+5** | City field != Address content |
| 9 | Country Match | Penalty | **+5** | Phone CC != Country Selection |
| 10 | Address Logic | Penalty | **+5** | AI detects nonsense address |

---

## 🧪 Testing

Test the engine using the provided mock payloads:

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d @test_payloads/test_country_mismatch.json
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <p>Built with ❤️ for a safer e-commerce experience.</p>
</div>
