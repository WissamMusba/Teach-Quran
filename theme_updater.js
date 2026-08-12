const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let hasNightMode = content.includes('nightMode');

  // Replace teal accent
  if (hasNightMode) {
    // If nightMode is in scope, use dynamic color
    content = content.replace(/['"]#00d4aa['"]/g, "(nightMode ? '#7BA7DB' : '#1C3D72')");
    // Also handle rgba(0,212,170,0.X) which is teal with opacity
    content = content.replace(/['"]rgba\(0,212,170,([0-9.]+)\)['"]/g, "(nightMode ? `rgba(123,167,219,${$1})` : `rgba(28,61,114,${$1})`)");
  } else {
    // Hardcoded to light mode colors
    content = content.replace(/['"]#00d4aa['"]/g, "'#1C3D72'");
    content = content.replace(/['"]rgba\(0,212,170,([0-9.]+)\)['"]/g, "`rgba(28,61,114,${$1})`");
    
    // Convert permanently dark screens (like Login, Register) to Light mode
    // Change background #121212 to #F8F9FA
    content = content.replace(/['"]#121212['"]/g, "'#F8F9FA'");
    // Change another dark background #1e1e1e to white #FFFFFF
    content = content.replace(/['"]#1e1e1e['"]/g, "'#FFFFFF'");
    // Change white text #fff or #ffffff to dark gray #1A1A1A
    content = content.replace(/['"]#fff['"]/g, "'#1A1A1A'");
    content = content.replace(/['"]#ffffff['"]/gi, "'#1A1A1A'");
  }

  // Add the secondary Gold color to a few specific elements if possible.
  // For example, if we see a Floating Action Button or something. We can leave this for manual or just let it all be blue for now.

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(srcDir);
console.log('Theme update complete.');
