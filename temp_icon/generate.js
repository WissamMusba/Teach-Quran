const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = 'C:\\Users\\wissa\\.gemini\\antigravity-ide\\brain\\8d289978-b722-47cb-8afa-1740f2f5a159\\media__1785949396590.jpg';
const RES_DIR = 'C:\\Users\\wissa\\Downloads\\QuranMasterApp\\android\\app\\src\\main\\res';

const sizes = {
  mdpi: { legacy: 48, adaptive: 108 },
  hdpi: { legacy: 72, adaptive: 162 },
  xhdpi: { legacy: 96, adaptive: 216 },
  xxhdpi: { legacy: 144, adaptive: 324 },
  xxxhdpi: { legacy: 192, adaptive: 432 }
};

async function generate() {
  // Use older jimp API for v0.16.13
  const img = await Jimp.read(SOURCE_IMAGE);
  
  for (const [bucket, size] of Object.entries(sizes)) {
    const dir = path.join(RES_DIR, `mipmap-${bucket}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // Scale image to safe zone (approx 66% of total adaptive size)
    const safeSize = Math.floor(size.adaptive * (72 / 108));
    const pad = Math.floor((size.adaptive - safeSize) / 2);
    
    const centerImg = img.clone().resize(safeSize, safeSize);
    
    // Create new image and composite center
    const paddedImg = await new Promise((resolve) => {
      new Jimp(size.adaptive, size.adaptive, (err, image) => {
        resolve(image);
      });
    });
    
    paddedImg.composite(centerImg, pad, pad);
    
    // Clamp to edge (Edge Pixel Replication) to seamlessly extend the gradient background
    paddedImg.scan(0, 0, size.adaptive, size.adaptive, function(x, y, idx) {
      if (x >= pad && x < pad + safeSize && y >= pad && y < pad + safeSize) {
        return; // Inside the center image, skip
      }
      
      // Find nearest pixel on the edge of the center image
      let nearestX = x;
      let nearestY = y;
      
      if (nearestX < pad) nearestX = pad;
      else if (nearestX >= pad + safeSize) nearestX = pad + safeSize - 1;
      
      if (nearestY < pad) nearestY = pad;
      else if (nearestY >= pad + safeSize) nearestY = pad + safeSize - 1;
      
      const color = paddedImg.getPixelColor(nearestX, nearestY);
      this.setPixelColor(color, x, y);
    });
    
    // Legacy icon
    const legacyImg = paddedImg.clone().resize(size.legacy, size.legacy);
    await legacyImg.writeAsync(path.join(dir, 'ic_launcher.png'));
    await legacyImg.writeAsync(path.join(dir, 'ic_launcher_round.png'));
    
    // Adaptive icon background
    await paddedImg.writeAsync(path.join(dir, 'ic_launcher_background.png'));
    
    // Adaptive icon foreground (transparent)
    const adaptiveFg = await new Promise((resolve) => {
      new Jimp(size.adaptive, size.adaptive, 0x00000000, (err, image) => {
        resolve(image);
      });
    });
    await adaptiveFg.writeAsync(path.join(dir, 'ic_launcher_foreground.png'));
  }

  // Create mipmap-anydpi-v26 XMLs
  const anydpiDir = path.join(RES_DIR, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anydpiDir)) fs.mkdirSync(anydpiDir, { recursive: true });
  
  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;

  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), xmlContent);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), xmlContent);
  
  console.log('Seamlessly padded icons generated successfully!');
}

generate().catch(console.error);
