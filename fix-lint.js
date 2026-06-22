const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\user\\OneDrive\\Documents\\Sunland\\sunland-crm\\src\\app\\(app)\\(ceo)\\admin\\finance';

const disableStr = '/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */\n';

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('page.tsx')) {
      results.push(file);
    }
  });
  return results;
};

const files = walk(dir);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('/* eslint-disable')) {
    content = content.replace(/\/\* eslint-disable[^\n]*\n/, disableStr);
  } else {
    content = disableStr + content;
  }
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
