#!/bin/bash
echo "Starting E-Commerce Fraud Detection System..."

# Start PostgreSQL database (in background)
echo "Starting database..."
cd /home/allyan/Documents/risk_analysis
docker-compose up -d

# Start FastAPI AI Service (in a new gnome-terminal tab/window)
echo "Starting FastAPI AI Service..."
gnome-terminal --tab --title="FastAPI" -- bash -c "cd /home/allyan/Documents/risk_analysis/backend/ai_service && source venv/bin/activate && uvicorn main:app --port 8000 --reload; exec bash"

# Start NestJS Main API (in a new gnome-terminal tab/window)
echo "Starting NestJS Main API..."
gnome-terminal --tab --title="NestJS API" -- bash -c "cd /home/allyan/Documents/risk_analysis/backend/main_api && npm run start:dev; exec bash"

# Start Next.js Frontend (in a new gnome-terminal tab/window)
echo "Starting Next.js Frontend..."
gnome-terminal --tab --title="Next.js Frontend" -- bash -c "cd /home/allyan/Documents/risk_analysis/frontend && npm run dev; exec bash"

echo "All services are starting up in separate terminal tabs/windows!"
echo "- UI Dashboard: http://localhost:3000"
echo "- NestJS API: http://localhost:3001"
echo "- FastAPI AI Service: http://localhost:8000"
