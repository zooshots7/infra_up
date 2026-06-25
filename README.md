<p align="center">
  <h1 align="center">🏙️ Infra Up — Civic Tech Platform</h1>
  <p align="center"><strong>Citizens, Logistics & Municipalities — All on One Map</strong></p>
  <p align="center">
    A civic tech startup platform letting citizens, logistics companies, and municipal governments see verified construction permits on an interactive map. Smart alerts for route-affecting work, citizen reporting, and government dashboards.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-Frontend-000000?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-PostGIS-4169E1?logo=postgresql&logoColor=white" alt="PostGIS" />
  <img src="https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/MapLibre_GL-Maps-4264FB?logo=mapbox&logoColor=white" alt="MapLibre" />
</p>

---

## ✨ Core Features

- 🗺️ **Interactive Map** — Construction, road, and utility markers with geospatial filtering
- 🔔 **Smart Alerts** — Route-affecting work notifications for commuters and logistics
- 📋 **Permit Transparency** — Full project details with verification documents
- 📸 **Citizen Reporting** — Report unverified construction with photo evidence
- 👨‍💼 **Government Dashboard** — Admin panel for project management and analytics
- 🔄 **Data Scrapers** — Automated ingestion from municipal open-data feeds

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Frontend["📱 Next.js PWA"]
        Map[Interactive Map<br/>MapLibre GL JS]
        Alerts[Route Alerts]
        Reporting[Citizen Reports]
        AdminUI[Admin Dashboard]
    end

    subgraph Backend["⚙️ FastAPI"]
        API[REST API]
        Scrapers[Data Scrapers<br/>Municipal Feeds]
    end

    subgraph Infrastructure["🗄️ Infrastructure"]
        PG[(PostgreSQL<br/>+ PostGIS)]
        Redis[(Redis)]
    end

    Map --> API
    Alerts --> API
    Reporting --> API
    AdminUI --> API
    API --> PG
    API --> Redis
    Scrapers --> PG
```

---

## 📁 Project Structure

```
infra_up/
├── frontend/           # Next.js web application
│   ├── app/            # App Router pages
│   ├── components/     # Map, cards, admin UI
│   └── Dockerfile
├── backend/            # FastAPI Python server
│   ├── app/            # API routes + models
│   ├── scrapers/       # Data ingestion scripts
│   ├── seed.py         # Sample data seeder
│   └── Dockerfile
├── shared/             # Shared definitions + constants
├── plans/              # Phase-by-phase implementation plans
├── docker-compose.yml  # Full stack orchestration
└── vercel.json         # Frontend deployment config
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
git clone https://github.com/zooshots7/infra_up.git
cd infra_up
docker-compose up --build
```

- 🌐 Frontend: `http://localhost:3000`
- 📡 Backend API: `http://localhost:8000`
- 📖 API Docs: `http://localhost:8000/docs`

### Option 2: Manual Setup

```bash
# Database
docker-compose up db redis -d

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install && npm run dev
```

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch
3. Commit and push
4. Open a Pull Request

## 📄 License

MIT License

---

<p align="center">
  <strong>Making urban infrastructure transparent 🏙️</strong>
</p>
