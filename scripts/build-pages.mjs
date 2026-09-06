import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const siteDir = path.join(rootDir, 'site');
const demoDir = path.join(rootDir, 'demo');
const sdkDistDir = path.join(rootDir, 'packages/sdk/dist');

// Clean and recreate site directory
if (fs.existsSync(siteDir)) {
  fs.rmSync(siteDir, { recursive: true, force: true });
}
fs.mkdirSync(siteDir, { recursive: true });

// Copy demo directory files to site root
fs.cpSync(demoDir, siteDir, { recursive: true });

// Create site/dist directory and copy SDK bundles
const siteDistDir = path.join(siteDir, 'dist');
fs.mkdirSync(siteDistDir, { recursive: true });

if (fs.existsSync(sdkDistDir)) {
  fs.cpSync(sdkDistDir, siteDistDir, { recursive: true });
} else {
  console.error('Error: SDK dist directory not found. Please run npm run build first.');
  process.exit(1);
}

// Add .nojekyll for GitHub Pages
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');

console.log('GitHub Pages static site successfully built in ./site');
