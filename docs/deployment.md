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
  "pip install -r backend/requirements.txt"
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

### Windows PowerShell

Default workflow lokal untuk Windows adalah menjalankan PADIS CLI dari root project:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

`.\padis.ps1 check` melakukan readiness check dasar. `.\padis.ps1 start` menjalankan backend Flask, frontend Next.js, lalu membuka Admin UI di `http://localhost:3000/admin`.

Launcher `.\padis.ps1` memakai `backend\venv\Scripts\python.exe` jika tersedia, lalu fallback ke `python` dari PATH.

Optional convenience alias:

```powershell
.\install-padis-command.ps1
```

Restart PowerShell, lalu:

```powershell
padis check
padis start
```

### Manual Debug

Backend dan frontend masih bisa dijalankan manual jika perlu debug terpisah:

```powershell
.\backend\venv\Scripts\Activate.ps1
python -m backend.run
```

```powershell
cd frontend
npm install
# create frontend/.env.local with:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
npm run dev
```

Backend berjalan di `http://localhost:5000`, frontend berjalan di `http://localhost:3000`.

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

Untuk local development, PADIS CLI melakukan readiness check backend dengan mencoba URL backend dan fallback ke pengecekan port `5000`. CLI tidak membutuhkan endpoint health baru dan tidak menambah route backend.

Untuk production deployment, gunakan mekanisme health check dari platform deploy yang dipakai. Jika platform membutuhkan endpoint HTTP khusus, desain endpoint tersebut sebagai perubahan backend terpisah, bukan syarat untuk menjalankan CLI lokal.
