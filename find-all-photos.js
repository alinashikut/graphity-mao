#!/usr/bin/env node

import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, '.tokens.json');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

if (fs.existsSync(TOKEN_PATH)) {
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oauth2Client.setCredentials(tokens);
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function findAllPhotos() {
  try {
    console.log('🔍 Searching for ALL images in Google Drive...\n');

    // Search for all image files
    const query = `(mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/heif' or mimeType='image/heic' or mimeType='image/webp') and trashed=false`;
    
    let allFiles = [];
    let pageToken = null;

    do {
      const res = await drive.files.list({
        q: query,
        spaces: 'drive',
        pageSize: 100,
        fields: 'files(id, name, parents, webContentLink, imageMediaMetadata, createdTime)',
        pageToken: pageToken,
      });

      allFiles = allFiles.concat(res.data.files || []);
      pageToken = res.data.nextPageToken;
      
      console.log(`Found ${allFiles.length} images so far...`);
    } while (pageToken);

    console.log(`\n✅ Total images found: ${allFiles.length}\n`);

    // Group by folder
    const folderMap = {};
    
    for (const file of allFiles) {
      const parentId = file.parents?.[0] || 'root';
      if (!folderMap[parentId]) {
        // Get folder name
        try {
          const folderRes = await drive.files.get({
            fileId: parentId,
            fields: 'name'
          });
          folderMap[parentId] = {
            name: folderRes.data.name || 'Unnamed',
            files: []
          };
        } catch (e) {
          folderMap[parentId] = {
            name: 'Unknown',
            files: []
          };
        }
      }
      folderMap[parentId].files.push(file);
    }

    // Display results
    for (const [folderId, data] of Object.entries(folderMap)) {
      console.log(`📁 ${data.name}: ${data.files.length} images`);
      if (data.files.length <= 10) {
        data.files.forEach(f => console.log(`   - ${f.name}`));
      }
    }

    // Save to file
    fs.writeFileSync(
      path.join(__dirname, 'all-photos.json'),
      JSON.stringify(allFiles, null, 2)
    );
    console.log(`\n💾 Saved to all-photos.json`);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findAllPhotos();
