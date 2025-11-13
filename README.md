# Predictor V13 Pro

A monorepo containing the frontend (React + Vite) and backend (Node + Express + TypeScript) for Predictor V13 Pro. Includes local Cloudflare Tunnel configuration for exposing the local dev/prod services via custom hostnames.

## Project Structure
- `web/` — React + Vite PWA
- `server/` — Express API with SQLite
- `cloudflared/` — Local Cloudflare Tunnel config (`config.yml`)

## Requirements
- Node.js 18+ and npm
- Windows (current dev environment) or any OS supported by Node
- A Cloudflare account and configured Tunnel (optional for local exposure)

## Setup
1. Install dependencies:
   - `cd web && npm install`
   - `cd ../server && npm install`
2. Configure environment variables:
   - Copy `server/.env.example` to `server/.env` and set values as needed.
3. Start in development:
   - Frontend: `cd web && npm run dev` (defaults to `http://localhost:5173`)
   - Backend: `cd server && npm run dev` (runs at `http://localhost:8080`)

## Build
- Frontend: `cd web && npm run build` (outputs to `web/dist`)
- Backend: `cd server && npm run build` (outputs to `server/dist`)

## Production
- Backend: `cd server && npm start` (runs `dist/index.js`)
- Frontend: serve `web/dist` with any static host (Nginx, Cloudflare Pages, Netlify, etc.).

## Cloudflare Tunnel (optional)
`cloudflared/config.yml` maps public hostnames to local services:
- `predictorv13pro.aviatorwin.co.ke` → `http://localhost:5173`
- `api.aviatorwin.co.ke` → `http://localhost:8080`

Run Tunnel locally:
```
& .\cloudflared.exe tunnel --config "C:\\Users\\KELVIN\\Aviator Predictor V13 Pro\\cloudflared\\config.yml" run aviatorpredictorV13pro
```

## Git & GitHub
This repo is initialized locally with a root `.gitignore`.

Initial commit and remote setup:
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/aidenjaymes03-oss/predictorv13pro.git
```

Push:
```
git push -u origin main
```

If your GitHub account is restricted or the push fails with a 403, use a different repository URL you control and update the remote:
```
git remote set-url origin <your-new-repo-url>
```