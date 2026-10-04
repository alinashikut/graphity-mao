# 🔧 Google API Setup Guide

**THE ONLY THING YOU NEED TO DO.** Everything else is automated. This takes ~10 minutes.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a Project"** → **"NEW PROJECT"**
3. Name it `Shikut Street Art Map`
4. Click **CREATE**

## Step 2: Enable Google APIs

1. In the left menu, go to **APIs & Services** → **Library**
2. Search for **"Google Drive API"**
   - Click on it → **ENABLE**
3. Search for **"Google Photos Library API"**
   - Click on it → **ENABLE**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth 2.0 Client ID**
3. If asked, configure the OAuth consent screen first:
   - User Type: **External**
   - Click **CREATE**
   - Fill in:
     - App name: `Shikut Street Art Map`
     - User support email: your email
     - Developer contact info: your email
   - Click **SAVE AND CONTINUE** through the remaining screens

4. Back to creating credentials:
   - Application type: **Web application**
   - Name: `Shikut Web Client`
   - Authorized JavaScript origins:
     - Add: `http://localhost:3001`
     - Add: `http://localhost:5173`
   - Authorized redirect URIs:
     - Add: `http://localhost:3001/auth/google/callback`
   - Click **CREATE**

## Step 4: Get Your Credentials

1. A popup will appear with your credentials
2. Click **DOWNLOAD** (as JSON)
3. Open the downloaded JSON file and copy:
   - `client_id` → `GOOGLE_CLIENT_ID`
   - `client_secret` → `GOOGLE_CLIENT_SECRET`

## Step 5: Set Environment Variables

1. Create `.env` file in the project root:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URL=http://localhost:3001/auth/google/callback
   ```

2. Replace with your actual values from Step 4

## Step 6: Run the App

```bash
npm install
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## How It Works

1. Click **"Sign in with Google"**
2. Authorize the app to access your Google Drive
3. Click **"Import from Google Drive"**
4. The app finds your "Street Art Map" folder
5. Extracts GPS coordinates from each photo
6. Displays them on the interactive map

---

**Need help?** The setup is straightforward, but Google's console can be confusing. If you get stuck at any step, let me know! 👍
