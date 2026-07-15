import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const srcDir = join(__dirname, '..', 'src');

function walk(dir) {
  let results = [];
  const list = readdirSync(dir);
  list.forEach(file => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);
let modifiedCount = 0;

files.forEach(file => {
  let content = readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace <ResponsiveContainer ...> keeping the inner props, but avoiding duplicates
  content = content.replace(/<ResponsiveContainer([^>]*)>/g, (match, p1) => {
    if (p1.includes('minHeight') || p1.includes('minWidth')) {
      return match; // already fixed
    }
    return `<ResponsiveContainer${p1} minHeight={0} minWidth={0}>`;
  });

  if (content !== originalContent) {
    writeFileSync(file, content, 'utf8');
    console.log(`Updated ${relative(srcDir, file)}`);
    modifiedCount++;
  }
});

console.log(`Finished. Modified ${modifiedCount} files.`);
