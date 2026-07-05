# ArogyaAI Deployment Guide

## Current Status

- ✅ **Backend deployed** at: `https://arogyaaai.onrender.com`
- ⏳ **Frontend ready to deploy** (configured to use Render backend)

---

## Frontend Environment Configuration

### Local Development
**File:** `client/.env.local`
```env
VITE_API_URL=https://arogyaaai.onrender.com/api/v1
```
- Calls local backend on `localhost:5000`
- Used when you run: `npm run dev`

### Production Deploy
**File:** `client/.env.production`
```env
VITE_API_URL=https://arogyaaai.onrender.com/api/v1
```
- Calls Render backend at `arogyaaai.onrender.com`
- **Automatically used when you deploy**

### Build Process
**File:** `client/vite.config.js`
- Dev mode: Uses proxy in `vite.config.js` (localhost:5000)
- Build mode: Uses `VITE_API_URL` from `.env.production` (Render)

---

## How It Works When You Deploy

### Step 1: Local Development (Now)
```bash
cd client
npm run dev
```
- Reads: `client/.env.local`
- API calls go to: `https://arogyaaai.onrender.com/api/v1` ✅
- Works with local backend

### Step 2: Build for Production (When deploying)
```bash
cd client
npm run build
```
- Reads: `client/.env.production`
- Embeds Render URL: `https://arogyaaai.onrender.com/api/v1`
- Creates `dist/` folder ready to deploy

### Step 3: Deploy Frontend (Render/Vercel/Netlify)
- Upload `dist/` folder to hosting
- Frontend automatically calls: `https://arogyaaai.onrender.com/api/v1` ✅
- No code changes needed!

---

## Frontend Hosting Options

### Option 1: Render (Same as Backend)
1. Create new "Static Site" service on Render
2. Connect your GitHub repo
3. Set:
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Deploy!

### Option 2: Vercel
1. Push code to GitHub
2. Go to `vercel.com` → Import project
3. Select `client` folder
4. Add environment variable: `VITE_API_URL=https://arogyaaai.onrender.com/api/v1`
5. Deploy!

### Option 3: Netlify
1. Push code to GitHub
2. Go to `netlify.com` → New site from Git
3. Set:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add environment variable: `VITE_API_URL=https://arogyaaai.onrender.com/api/v1`
5. Deploy!

---

## Environment Variables

### For Render/Vercel/Netlify (if needed)
Since `.env.production` is committed, these platforms will automatically read it.

**Optional:** If deploying to different region, override with:
```
VITE_API_URL=https://arogyaaai.onrender.com/api/v1
VITE_SOCKET_URL=https://arogyaaai.onrender.com
```

---

## Testing After Deployment

1. **Open frontend:** `https://your-frontend-domain.com`
2. **Open DevTools** → **Network** tab
3. **Try login** or any API call
4. **Check request URL:**
   - Should be: `https://arogyaaai.onrender.com/api/v1/...` ✅
   - NOT: `https://arogyaaai.onrender.com/...` ❌

---

## File Structure

```
ArogyaAI/
├── client/
│   ├── .env.local           ← Local dev (localhost:5000)
│   ├── .env.production      ← Production (Render)
│   ├── .env.example         ← Template
│   ├── src/
│   ├── vite.config.js       ← Dev proxy + build config
│   ├── package.json
│   └── ...
├── server/
│   ├── .env                 ← Server secrets
│   ├── src/
│   └── ...
└── DEPLOYMENT_GUIDE.md      ← You are here
```

---

## Summary

✅ **Backend:** Already deployed at `https://arogyaaai.onrender.com`

✅ **Frontend:** Configured to call Render backend after deploy
- Local dev uses `https://arogyaaai.onrender.com`
- Production uses `https://arogyaaai.onrender.com`
- Automatically switches based on build environment

✅ **Ready to deploy!**
- No code changes needed
- Just push to Render/Vercel/Netlify
- Frontend will automatically call Render backend

---

## Quick Links

- **Backend Health Check:** https://arogyaaai.onrender.com/health
- **Backend Readiness:** https://arogyaaai.onrender.com/readiness
- **Backend Logs:** https://dashboard.render.com (check deployments)

---

**When you're ready to deploy frontend, just push to GitHub and connect to your hosting platform!** 🚀
