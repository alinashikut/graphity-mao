# 🎨 Shikut Street Art Map

Browse the world's street art — an interactive map of graffiti and street art from travels around the world.

**Live preview:** Click a marker to see the exact location on Google Maps!

## 🚀 Quick Start

### 1. Setup Google API (5 minutes)

Follow the guide: **[SETUP_GOOGLE_API.md](SETUP_GOOGLE_API.md)**

TL;DR:
- Create a Google Cloud project
- Enable Google Drive API
- Create OAuth 2.0 credentials
- Add credentials to `.env` file

### 2. Install & Run

```bash
# Install dependencies
npm install

# Start both frontend and backend
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### 3. Import Your Photos

1. Click **"Sign in with Google"**
2. Authorize the app
3. Click **"Import from Google Drive"**
4. The app will:
   - Find your "Street Art Map" folder
   - Extract GPS coordinates from photos
   - Display them on the map

## 📁 Project Structure

```
├── src/
│   ├── components/           # React components
│   │   ├── Map.jsx          # Leaflet map
│   │   ├── GoogleAuth.jsx   # Google login
│   │   └── ImportPanel.jsx  # Import controls
│   ├── App.jsx              # Main app
│   ├── App.css              # Styles
│   └── index.jsx            # React entry point
├── server/
│   └── index.js             # Express server + Google API
├── index.html               # HTML template
├── package.json
├── vite.config.js           # Vite config
└── SETUP_GOOGLE_API.md      # Google API setup guide
```

## 🔑 How It Works

1. **Google OAuth**: Sign in once to authorize access to Google Drive
2. **File Discovery**: Server finds "Street Art Map" folder and lists photos
3. **EXIF Extraction**: Extracts GPS coordinates from each photo's metadata
4. **Map Visualization**: Displays markers on interactive Leaflet map
5. **Google Maps Link**: Each marker links to Google Maps for navigation

## 🛠️ Tech Stack

- **Frontend**: React + Leaflet (interactive map)
- **Backend**: Node.js + Express
- **APIs**: Google Drive API + Google Photos Library API
- **Build**: Vite
- **Map**: OpenStreetMap tiles

## 📝 Adding Photos

Just add photos to your "Street Art Map" Google Drive folder with GPS metadata (taken from phone camera), then click "Import" in the app.

## 🚢 Deployment

To deploy to production:

```bash
npm run build
```

This creates optimized files in `dist/` folder.

---

Made with ❤️ for street art lovers
