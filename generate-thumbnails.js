#!/usr/bin/env node
// Downloads Drive-generated previews for every artwork into public/thumbs/<id>.jpg
// so the public site can show thumbnails without Google auth.

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, '.tokens.json');
const ARTWORKS_DB = path.join(__dirname, 'src/data/artworks.json');
const OUT_DIR = path.join(__dirname, 'public/thumbs');
const SIZE = 240;
const force = process.argv.includes('--force');

const secretFile = fs.readdirSync(__dirname).find(f => /^client_secret_.*\.json$/.test(f));
if (!secretFile || !fs.existsSync(TOKEN_PATH)) {
  console.error('❌ Need client_secret_*.json and .tokens.json in the project root.');
  process.exit(1);
}
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, secretFile), 'utf8'));
const { client_id, client_secret, redirect_uris } = creds.web || creds.installed;
const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0]);
auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
auth.on('tokens', t => {
  const current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...current, ...t }, null, 2));
});
const drive = google.drive({ version: 'v3', auth });

const { cities } = JSON.parse(fs.readFileSync(ARTWORKS_DB, 'utf8'));
const artworks = cities.flatMap(c => c.artworks || []);
fs.mkdirSync(OUT_DIR, { recursive: true });

let ok = 0, skipped = 0;
const failed = [];

for (const art of artworks) {
  const out = path.join(OUT_DIR, `${art.id}.jpg`);
  if (!force && fs.existsSync(out)) { skipped++; continue; }
  try {
    const { data } = await drive.files.get({ fileId: art.id, fields: 'thumbnailLink' });
    if (!data.thumbnailLink) throw new Error('Drive has no preview for this file');
    const url = data.thumbnailLink.replace(/=s\d+$/, `=s${SIZE}`);
    const { token } = await auth.getAccessToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tmp = `${out}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    // Normalise to JPEG (previews may come back as PNG/WebP)
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', tmp, '--out', out], { stdio: 'ignore' });
    fs.unlinkSync(tmp);
    ok++;
    process.stdout.write(`✅ ${art.fileName}\n`);
  } catch (err) {
    failed.push(art.fileName);
    process.stdout.write(`❌ ${art.fileName}: ${err.message}\n`);
  }
}

console.log(`\nDone: ${ok} downloaded, ${skipped} already present, ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
