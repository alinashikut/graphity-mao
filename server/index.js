import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let oauth2Client;
const TOKEN_PATH = path.join(process.cwd(), '.tokens.json');
const ARTWORKS_DB = path.join(process.cwd(), 'src/data/artworks.json');

function initializeGoogle() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
  const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3001/auth/google/callback';

  oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(tokens);
      console.log('✅ Tokens loaded. User is authenticated.');
    } catch (err) {
      console.log('⚠️ Need to authenticate first');
    }
  }
}

// Route: Get Google auth URL
app.get('/api/auth/google-url', (req, res) => {
  if (!oauth2Client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/photoslibrary.readonly'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  res.json({ authUrl });
});

// Route: Handle OAuth callback (with /callback suffix)
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.redirect('http://localhost:5173?auth=success');
  } catch (err) {
    console.error('Error getting tokens:', err);
    res.redirect('http://localhost:5173?auth=error');
  }
});

// Route: Handle OAuth callback (without /callback suffix for Google Cloud)
app.get('/auth/google', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.redirect('http://localhost:5173?auth=success');
  } catch (err) {
    console.error('Error getting tokens:', err);
    res.redirect('http://localhost:5173?auth=error');
  }
});

// Route: Scan Google Drive for street art photos
app.get('/api/scan/drive', async (req, res) => {
  try {
    if (!oauth2Client.credentials.access_token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderRes = await drive.files.list({
      q: `name='Street Art Map' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id, name)',
    });

    if (folderRes.data.files.length === 0) {
      return res.status(404).json({ error: 'Street Art Map folder not found' });
    }

    const folderId = folderRes.data.files[0].id;

    const filesRes = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png') and trashed=false`,
      spaces: 'drive',
      pageSize: 100,
      fields: 'files(id, name, webContentLink, createdTime, imageMediaMetadata)',
    });

    const filesWithData = filesRes.data.files.map(file => ({
      id: file.id,
      name: file.name,
      webContentLink: file.webContentLink,
      createdTime: file.createdTime,
      coordinates: extractCoordinatesFromDrive(file),
      thumbnail: `https://lh3.googleusercontent.com/d/${file.id}=w200`,
      source: 'google_drive'
    }));

    res.json({
      folder: 'Street Art Map',
      source: 'google_drive',
      files: filesWithData,
      total: filesWithData.length
    });

  } catch (err) {
    console.error('Error scanning Drive:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route: Scan Google Photos
app.get('/api/scan/photos', async (req, res) => {
  try {
    if (!oauth2Client.credentials.access_token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const photosLibrary = google.photoslibrary({ version: 'v1', auth: oauth2Client });
    const albumsRes = await photosLibrary.albums.list({ pageSize: 50 });

    const streetArtAlbums = albumsRes.data.albums?.filter(
      album => album.title.toLowerCase().includes('street') ||
               album.title.toLowerCase().includes('art') ||
               album.title.toLowerCase().includes('граффити')
    ) || [];

    let allPhotos = [];
    for (const album of streetArtAlbums) {
      try {
        const searchRes = await photosLibrary.mediaItems.search({
          albumId: album.id,
          pageSize: 100,
        });

        if (searchRes.data.mediaItems) {
          allPhotos = allPhotos.concat(
            searchRes.data.mediaItems.map(item => ({
              id: item.id,
              name: item.filename,
              url: item.baseUrl,
              mediaMetadata: item.mediaMetadata,
              thumbnail: item.baseUrl + '=w200',
              albumTitle: album.title,
              coordinates: extractCoordinatesFromPhotos(item.mediaMetadata),
              source: 'google_photos'
            }))
          );
        }
      } catch (err) {
        console.log(`Could not access album ${album.title}`);
      }
    }

    res.json({
      source: 'google_photos',
      albums: streetArtAlbums.map(a => a.title),
      files: allPhotos,
      total: allPhotos.length
    });

  } catch (err) {
    console.error('Error scanning Photos:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route: Save approved artwork
app.post('/api/approve-artwork', async (req, res) => {
  try {
    const { fileId, fileName, coordinates, year, city, source } = req.body;

    let artworksData = { cities: [] };
    if (fs.existsSync(ARTWORKS_DB)) {
      artworksData = JSON.parse(fs.readFileSync(ARTWORKS_DB, 'utf8'));
    }

    let cityEntry = artworksData.cities.find(c => c.city === city);
    if (!cityEntry) {
      cityEntry = {
        id: city.toLowerCase().replace(/\s+/g, '-'),
        city: city,
        country: '',
        lat: coordinates.lat,
        lng: coordinates.lng,
        artworks: []
      };
      artworksData.cities.push(cityEntry);
    }

    const artwork = {
      id: fileId,
      fileName: fileName,
      lat: coordinates.lat,
      lng: coordinates.lng,
      year: year,
      source: source,
      approved: true,
      addedAt: new Date().toISOString()
    };

    cityEntry.artworks.push(artwork);
    fs.writeFileSync(ARTWORKS_DB, JSON.stringify(artworksData, null, 2));

    res.json({ success: true, artwork });

  } catch (err) {
    console.error('Error approving artwork:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route: Get unapproved photos for review (with auto-filtering)
app.post('/api/get-review-queue', async (req, res) => {
  try {
    const { files } = req.body;

    if (!oauth2Client.credentials.access_token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let approvedIds = new Set();
    if (fs.existsSync(ARTWORKS_DB)) {
      const artworksData = JSON.parse(fs.readFileSync(ARTWORKS_DB, 'utf8'));
      artworksData.cities.forEach(city => {
        city.artworks.forEach(art => {
          approvedIds.add(art.id);
        });
      });
    }

    // Filter files
    const filtered = files
      .filter(f => !approvedIds.has(f.id)) // Not already approved
      .filter(f => f.coordinates?.hasCoordinates) // Has GPS coordinates
      .filter(f => !isLikelyScreenshot(f)) // Not a screenshot
      .filter(f => isValidCoordinates(f.coordinates)); // Coordinates are reasonable

    res.json({
      new: filtered,
      total: filtered.length,
      approved: approvedIds.size,
      filtered: {
        noCoords: files.filter(f => !f.coordinates?.hasCoordinates).length,
        screenshots: files.filter(f => isLikelyScreenshot(f)).length,
        invalidCoords: files.filter(f => !isValidCoordinates(f.coordinates)).length
      }
    });

  } catch (err) {
    console.error('Error getting review queue:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    auth: oauth2Client?.credentials?.access_token ? 'authenticated' : 'not authenticated'
  });
});

// Helper functions
function extractCoordinatesFromDrive(file) {
  try {
    if (file.imageMediaMetadata?.location) {
      return {
        lat: file.imageMediaMetadata.location.latitude,
        lng: file.imageMediaMetadata.location.longitude,
        hasCoordinates: true
      };
    }
    return { hasCoordinates: false };
  } catch (err) {
    return { hasCoordinates: false, error: err.message };
  }
}

function extractCoordinatesFromPhotos(mediaMetadata) {
  try {
    if (mediaMetadata?.location) {
      return {
        lat: mediaMetadata.location.latitude,
        lng: mediaMetadata.location.longitude,
        hasCoordinates: true
      };
    }
    return { hasCoordinates: false };
  } catch (err) {
    return { hasCoordinates: false, error: err.message };
  }
}

// Check if file is likely a screenshot (suspicious aspect ratio, common phone screen sizes)
function isLikelyScreenshot(file) {
  // Screenshots often have specific aspect ratios
  // Phone: 9:16, 10:19.5, Tablet: 4:3, 16:9, etc.
  const suspiciousAspectRatios = [
    0.56, 0.57, // 9:16
    0.51, 0.52, // 10:19.5
    1.33, // 4:3
    1.78, // 16:9
  ];

  try {
    // For simplicity, we can't check dimensions from metadata,
    // but we can check file name patterns
    const name = file.name?.toLowerCase() || '';
    if (name.includes('screenshot') || name.includes('скриншот') ||
        name.includes('screen shot') || name.includes('img_') && name.includes('png')) {
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

// Check if coordinates are valid and reasonable
function isValidCoordinates(coords) {
  if (!coords || !coords.hasCoordinates) return false;

  const { lat, lng } = coords;

  // Valid latitude: -90 to 90
  // Valid longitude: -180 to 180
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  // Both 0 (common error from phones)
  if (lat === 0 && lng === 0) {
    return false;
  }

  return true;
}

initializeGoogle();

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📸 Frontend will run at http://localhost:5173`);
});
