const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');
if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

const filesToCopy = ['index.html', 'style.css', 'app.js', 'manifest.json', 'sw.js'];

for (const file of filesToCopy) {
  const src = path.join(__dirname, file);
  const dest = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

const versionInfo = {
  version: require('./package.json').version,
  buildTime: new Date().toISOString()
};

fs.writeFileSync(path.join(__dirname, 'version.json'), JSON.stringify(versionInfo, null, 2));
fs.writeFileSync(path.join(wwwDir, 'version.json'), JSON.stringify(versionInfo, null, 2));

console.log('Build completed: synced web assets to www/');
