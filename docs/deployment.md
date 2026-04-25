# Deployment

## Backend — Railway

The backend deploys to Railway using the `railway.toml` config at the project root.

### railway.toml

```toml
[phases.setup]
nixPkgs = ["python311", "python311Packages.pip"]

[phases.build]
cmds = [
  "python -m venv /app/.venv",
  ". /app/.venv/bin/activate",
  "pip install -r backend/requirements.txt",
  "playwright install chromium"
]

[start]
cmd = "cd backend && gunicorn run:app"
```

### Deploy Steps

1. Connect GitHub repository to Railway project
2. Set environment variables in Railway dashboard (see below)
3. Railway auto-deploys on push to `main`

### Backend Environment Variables (Railway)

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Supabase connection string |
| `SECRET_KEY` | `<random-64-char-string>` | JWT signing key |
| `FLASK_ENV` | `production` | Disables debug mode |

### Gunicorn

Railway starts: `cd backend && gunicorn run:app`

`run.py` instantiates the Flask app via the factory:
```python
from app import create_app
app = create_app()
```

For production, tune workers based on Railway instance size:
```bash
gunicorn run:app --workers 2 --timeout 120 --bind 0.0.0.0:$PORT
```

Tile generation can be CPU-intensive — `timeout 120` prevents premature worker kills.

---

## Frontend — Vercel (or Railway)

The frontend is a standard Next.js app and deploys to any platform that supports Node.js.

### Vercel Deploy

1. Import repository in Vercel
2. Set root directory to `frontend/`
3. Set environment variable:
   - `NEXT_PUBLIC_API_BASE_URL` = Railway backend URL (e.g. `https://padis-api.railway.app`)
4. Deploy

### Railway Deploy (alternative)

Add a second Railway service pointing to `frontend/`:

```toml
[start]
cmd = "cd frontend && npm run build && npm start"
```

### Frontend Environment Variables

| Variable | Example | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://padis-api.railway.app` | Backend base URL |

> **Important:** The app throws an error at startup if this variable contains `127.0.0.1` — preventing accidental production builds pointing to localhost.

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill DATABASE_URL and SECRET_KEY
python run.py
```

Server runs at `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
# create frontend/.env.local with:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
npm run dev
```

App runs at `http://localhost:3000`.

### Database Setup

The database schema is managed via Alembic migrations.

```bash
cd backend
alembic upgrade head
```

Ensure PostGIS extension is enabled in your PostgreSQL instance:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## CORS Configuration

Flask-CORS is configured in `app/__init__.py`. In development, all origins are allowed. In production, restrict to your frontend domain:

```python
CORS(app, resources={r"/api/*": {"origins": "https://your-frontend.vercel.app"}})
```

---

## Health Check

Railway uses the HTTP response from the start command. Ensure the Flask app responds at `/` or add a health route:

```python
@app.route("/health")
def health():
    return {"status": "ok"}, 200
```
