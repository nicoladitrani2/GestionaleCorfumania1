const fs = require('fs');
const path = require('path');
const https = require('https');

const icons = [
  {
    url: 'https://placehold.co/192x192/2563eb/ffffff.png?text=App',
    path: '../public/icons/icon-192x192.png'
  },
  {
    url: 'https://placehold.co/512x512/2563eb/ffffff.png?text=App',
    path: '../public/icons/icon-512x512.png'
  }
];

icons.forEach(icon => {
  const filePath = path.join(__dirname, icon.path);
  const file = fs.createWriteStream(filePath);
  
  https.get(icon.url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${icon.path}`);
    });
  }).on('error', (err) => {
    fs.unlink(filePath, () => {}); // Delete the file async. (But we don't check result)
    console.error(`Error downloading ${icon.path}: ${err.message}`);
  });
});
