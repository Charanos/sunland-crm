import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getFiles('src/components/sunland');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Add body-sm to all these tab nav links
  content = content.replace(/className="([^"]*)px-3\.5 py-1\.5 rounded-lg transition-all flex items-center gap-1\.5([^"]*)"/g, (match, p1, p2) => {
    // only add body-sm if it's not already there
    if (!match.includes('body-sm')) {
      return `className="${p1}body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5${p2}"`;
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
    changedCount++;
  }
}
console.log('Total files changed with body-sm:', changedCount);
