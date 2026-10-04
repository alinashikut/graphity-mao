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

async function debug() {
  try {
    // Find folder
    const folderRes = await drive.files.list({
      q: `name contains 'street' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 10,
      fields: 'files(id, name)',
    });

    console.log('📁 Found folders:');
    folderRes.data.files.forEach(f => console.log(`  - ${f.name} (${f.id})`));

    if (folderRes.data.files.length > 0) {
      const folderId = folderRes.data.files[0].id;
      console.log(`\n📂 Looking inside "${folderRes.data.files[0].name}"...`);

      // List all files in folder
      const filesRes = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        pageSize: 50,
        fields: 'files(id, name, mimeType)',
      });

      console.log(`\n📄 Found ${filesRes.data.files.length} items:`);
      filesRes.data.files.forEach(f => {
        console.log(`  - ${f.name} (${f.mimeType})`);
      });

      // Look for images specifically
      const imagesRes = await drive.files.list({
        q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png') and trashed=false`,
        spaces: 'drive',
        pageSize: 50,
        fields: 'files(id, name)',
      });

      console.log(`\n🖼️  Found ${imagesRes.data.files.length} images`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

debug();
