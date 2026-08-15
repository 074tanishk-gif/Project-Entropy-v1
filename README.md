# Project Entropy — Study Timer

## Run locally
```
npm install
npm run dev
```

## Deploy on Vercel
1. Push this whole folder to a GitHub repo (keep the folder structure exactly as-is — `package.json` and `index.html` must be at the repo root, not nested inside a subfolder).
2. On vercel.com, "Add New Project" → import the repo.
3. Vercel auto-detects Vite. Leave the default build settings (`npm run build`, output folder `dist`) and deploy.

## Notes
- Data is stored in the browser's `localStorage`, so each device/browser keeps its own separate history — there's no shared backend.
