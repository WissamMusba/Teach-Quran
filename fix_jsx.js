const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      // Fix `attr=(nightMode ? 'A' : 'B')` to `attr={(nightMode ? 'A' : 'B')}`
      // This matches the exact string my previous script generated
      content = content.replace(/([a-zA-Z0-9_]+)=\(nightMode \? '([^']+)' : '([^']+)'\)/g, '$1={(nightMode ? \'$2\' : \'$3\')}');
      content = content.replace(/([a-zA-Z0-9_]+)=\(nightMode \? `rgba([^`]+)` : `rgba([^`]+)`\)/g, '$1={(nightMode ? `rgba$2` : `rgba$3`)}');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed JSX in: ${fullPath}`);
      }
    }
  }
}

walkDir(path.join(__dirname, 'src'));
console.log('JSX syntax fix complete.');
