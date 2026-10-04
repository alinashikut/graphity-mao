#!/usr/bin/env node

import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;

const ARTWORKS_DB = path.join(__dirname, 'src/data/artworks.json');
const TOKEN_PATH = path.join(__dirname, '.tokens.json');

let oauth2Client;

function initializeGoogle() {
  oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(tokens);
      console.log('✅ Using saved tokens');
      return true;
    } catch (err) {
      console.log('⚠️  Token file corrupted');
      return false;
    }
  }
  return false;
}

async function getAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/photoslibrary.readonly'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  console.log('🔐 Authorize here:', authUrl);
  console.log('\nAfter authorization, you\'ll be redirected. Copy the code from the URL.');
  console.log('Then run: node import-photos.js --code YOUR_CODE_HERE\n');
}

async function handleAuthCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('✅ Tokens saved!');
}

async function importFromGoogleDrive() {
  try {
    console.log('\n📁 Scanning Google Drive...');

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Find "Street Art Map" folder
    const folderRes = await drive.files.list({
      q: `name='Street Art Map' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id, name)',
    });

    if (folderRes.data.files.length === 0) {
      console.log('⚠️  Street Art Map folder not found in Drive');
      return [];
    }

    const folderId = folderRes.data.files[0].id;
    console.log(`✅ Found folder: ${folderRes.data.files[0].name}`);

    // Get all images
    const filesRes = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png') and trashed=false`,
      spaces: 'drive',
      pageSize: 100,
      fields: 'files(id, name, imageMediaMetadata, createdTime)',
    });

    const photos = filesRes.data.files.map(file => ({
      id: file.id,
      name: file.name,
      source: 'google_drive',
      coordinates: extractCoordinates(file.imageMediaMetadata),
      createdTime: file.createdTime,
      thumbnail: `https://lh3.googleusercontent.com/d/${file.id}=w200`
    }));

    console.log(`✅ Found ${photos.length} photos in Drive`);
    return photos;

  } catch (err) {
    console.error('❌ Error scanning Drive:', err.message);
    return [];
  }
}

async function importFromGooglePhotos() {
  try {
    console.log('\n📷 Scanning Google Photos...');

    const photosLibrary = google.photoslibrary({ version: 'v1', auth: oauth2Client });
    const albumsRes = await photosLibrary.albums.list({ pageSize: 50 });

    const streetArtAlbums = albumsRes.data.albums?.filter(
      album => album.title.toLowerCase().includes('street') ||
               album.title.toLowerCase().includes('art') ||
               album.title.toLowerCase().includes('граффити')
    ) || [];

    console.log(`✅ Found ${streetArtAlbums.length} street art albums`);

    let allPhotos = [];
    for (const album of streetArtAlbums) {
      try {
        const searchRes = await photosLibrary.mediaItems.search({
          albumId: album.id,
          pageSize: 100,
        });

        if (searchRes.data.mediaItems) {
          const photos = searchRes.data.mediaItems
            .filter(item => item.mediaMetadata?.photo)
            .map(item => ({
              id: item.id,
              name: item.filename,
              source: 'google_photos',
              coordinates: extractCoordinates(item.mediaMetadata),
              url: item.baseUrl,
              thumbnail: item.baseUrl + '=w200',
              albumTitle: album.title
            }));

          allPhotos = allPhotos.concat(photos);
        }
      } catch (err) {
        console.log(`⚠️  Could not access album ${album.title}`);
      }
    }

    // Remove duplicates
    const uniquePhotos = Array.from(new Map(allPhotos.map(p => [p.id, p])).values());
    console.log(`✅ Found ${uniquePhotos.length} unique photos in Photos`);
    return uniquePhotos;

  } catch (err) {
    console.error('❌ Error scanning Photos:', err.message);
    return [];
  }
}

function extractCoordinates(mediaMetadata) {
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
    return { hasCoordinates: false };
  }
}

async function saveToDatabase(allPhotos) {
  try {
    let artworksData = { cities: [] };
    if (fs.existsSync(ARTWORKS_DB)) {
      artworksData = JSON.parse(fs.readFileSync(ARTWORKS_DB, 'utf8'));
    }

    // Group by coordinates
    const photosByLocation = {};
    allPhotos.forEach(photo => {
      if (photo.coordinates.hasCoordinates) {
        const key = `${photo.coordinates.lat.toFixed(4)},${photo.coordinates.lng.toFixed(4)}`;
        if (!photosByLocation[key]) {
          photosByLocation[key] = [];
        }
        photosByLocation[key].push(photo);
      }
    });

    let addedCount = 0;
    for (const [coords, photos] of Object.entries(photosByLocation)) {
      const [lat, lng] = coords.split(',').map(Number);

      // Try to find existing city or create new
      let cityEntry = artworksData.cities.find(c =>
        Math.abs(c.lat - lat) < 0.01 && Math.abs(c.lng - lng) < 0.01
      );

      if (!cityEntry) {
        // Estimate city name from coordinates
        const cityName = getApproximateCity(lat, lng);
        cityEntry = {
          id: cityName.toLowerCase().replace(/\s+/g, '-'),
          city: cityName,
          country: getCountry(lat, lng),
          lat: lat,
          lng: lng,
          artworks: []
        };
        artworksData.cities.push(cityEntry);
      }

      // Add photos
      photos.forEach(photo => {
        const artwork = {
          id: photo.id,
          fileName: photo.name,
          lat: lat,
          lng: lng,
          source: photo.source,
          approved: true,
          addedAt: new Date().toISOString()
        };

        // Check if already exists
        if (!cityEntry.artworks.find(a => a.id === artwork.id)) {
          cityEntry.artworks.push(artwork);
          addedCount++;
        }
      });
    }

    fs.writeFileSync(ARTWORKS_DB, JSON.stringify(artworksData, null, 2));
    console.log(`\n✅ Added ${addedCount} photos to database`);
    console.log(`📊 Total cities: ${artworksData.cities.length}`);
    artworksData.cities.forEach(city => {
      console.log(`   📍 ${city.city}: ${city.artworks.length} photos`);
    });

  } catch (err) {
    console.error('❌ Error saving to database:', err.message);
  }
}

function getApproximateCity(lat, lng) {
  // Simple city detection by coordinates
  // Kathmandu: 27.7172, 85.3240
  if (lat > 25 && lat < 30 && lng > 83 && lng < 87) return 'Kathmandu';
  // Bangkok: 13.7563, 100.5018
  if (lat > 10 && lat < 16 && lng > 98 && lng < 102) return 'Bangkok';
  // Europe: lat > 35, lng > -10 && lng < 40
  if (lat > 35 && lat < 72 && lng > -10 && lng < 40) return 'Europe';

  return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
}

function getCountry(lat, lng) {
  if (lat > 25 && lat < 30 && lng > 83 && lng < 87) return 'Nepal';
  if (lat > 10 && lat < 16 && lng > 98 && lng < 102) return 'Thailand';
  return 'Unknown';
}

async function main() {
  console.log('🚀 Street Art Map Photo Importer\n');

  if (!initializeGoogle()) {
    console.log('⚠️  Not authenticated yet.\n');

    const codeArg = process.argv.find(arg => arg.startsWith('--code='));
    if (codeArg) {
      const code = codeArg.split('=')[1];
      console.log('🔐 Authenticating with code...');
      await handleAuthCode(code);
      await main(); // Retry
      return;
    }

    await getAuthUrl();
    return;
  }

  console.log('📸 Importing all your street art photos...\n');

  const drivePhotos = await importFromGoogleDrive();
  const photosPhotos = await importFromGooglePhotos();

  const allPhotos = [...drivePhotos, ...photosPhotos];

  // Remove duplicates
  const unique = Array.from(new Map(allPhotos.map(p => [p.id, p])).values());

  console.log(`\n📊 Total unique photos: ${unique.length}`);

  if (unique.length > 0) {
    await saveToDatabase(unique);
    console.log('\n✅ Import complete! Refresh your browser to see the photos on the map.');
  }
}

main().catch(err => console.error('Error:', err));
