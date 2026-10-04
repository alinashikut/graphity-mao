#!/usr/bin/env node

import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, '.tokens.json');
const ARTWORKS_DB = path.join(__dirname, 'src/data/artworks.json');
const SERVICE_ACCOUNT_KEY = path.join(__dirname, 'service-account-key.json');

let oauth2Client;
let useServiceAccount = false;

function initializeGoogle() {
  // Try Service Account first
  if (fs.existsSync(SERVICE_ACCOUNT_KEY)) {
    try {
      const keyfile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY, 'utf8'));
      oauth2Client = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_KEY,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/photoslibrary.readonly'
        ]
      });
      useServiceAccount = true;
      console.log('✅ Using Service Account authentication');
      return true;
    } catch (err) {
      console.log('⚠️ Service Account key invalid');
    }
  }

  // Fall back to OAuth
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;

  oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(tokens);
      console.log('✅ Using OAuth tokens (previously authorized)');
      return true;
    } catch (err) {
      console.log('⚠️ Token file corrupted');
      return false;
    }
  }

  console.log('❌ No authentication found!');
  return false;
}

async function importFromGoogleDrive() {
  try {
    console.log('\n📁 Scanning Google Drive...');

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderRes = await drive.files.list({
      q: `name='Street Art Map' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id, name)',
    });

    if (folderRes.data.files.length === 0) {
      console.log('⚠️ Street Art Map folder not found in Drive');
      return [];
    }

    const folderId = folderRes.data.files[0].id;
    console.log(`✅ Found folder: ${folderRes.data.files[0].name}`);

    const filesRes = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/heif' or mimeType='image/heic' or mimeType='image/webp') and trashed=false`,
      spaces: 'drive',
      pageSize: 100,
      fields: 'files(id, name, webContentLink, createdTime, imageMediaMetadata)',
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
        console.log(`⚠️ Could not access album ${album.title}`);
      }
    }

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
      const cityName = getApproximateCity(lat, lng);
      const cityId = cityName.toLowerCase().replace(/\s+/g, '-');

      let cityEntry = artworksData.cities.find(c => c.id === cityId);

      if (!cityEntry) {
        cityEntry = {
          id: cityId,
          city: cityName,
          country: getCountry(lat, lng),
          lat: lat,
          lng: lng,
          artworks: []
        };
        artworksData.cities.push(cityEntry);
      }

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
  if (lat > 25 && lat < 30 && lng > 83 && lng < 87) return 'Kathmandu';
  if (lat > 10 && lat < 16 && lng > 98 && lng < 102) return 'Bangkok';
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
    console.log('\n❌ No authentication available!');
    process.exit(1);
  }

  console.log('\n📸 Importing all your street art photos...\n');

  const drivePhotos = await importFromGoogleDrive();
  const photosPhotos = await importFromGooglePhotos();

  const allPhotos = [...drivePhotos, ...photosPhotos];
  const unique = Array.from(new Map(allPhotos.map(p => [p.id, p])).values());

  console.log(`\n📊 Total unique photos: ${unique.length}`);

  if (unique.length > 0) {
    await saveToDatabase(unique);
    console.log('\n✅ Import complete! Refresh your browser to see the photos on the map.');
  } else {
    console.log('\n⚠️ No photos with coordinates found.');
  }
}

main().catch(err => console.error('Error:', err));
