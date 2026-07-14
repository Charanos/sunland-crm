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

  // Fix Properties Board Overdesigned nav (Revert it to standard, but without bad typography)
  if (file.includes('properties-board.tsx') || file.includes('valuations-board.tsx')) {
    content = content.replace(/<div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-6 rounded-\[24px\] shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] hover:shadow-\[0_16px_40px_rgb\(0,0,0,0\.06\)\] transition-all">/g,
      '<div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">');

    content = content.replace(/<div className="flex items-center gap-3">/g, '<div className="flex items-center gap-2">');

    content = content.replace(/<div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100\/50">/g,
      '<div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">');

    content = content.replace(/<IconBuildingCommunity size={20} \/>/g, '<IconBuildingCommunity size={16} />');
    content = content.replace(/<p className="text-desc-secondary mt-0\.5">/g, '<p className="text-sm text-slate-400 mt-1">');

    content = content.replace(/<div className="flex bg-slate-50 p-1\.5 rounded-2xl flex-wrap gap-1 border border-slate-100\/80 shadow-inner">/g,
      '<div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">');

    content = content.replace(/className="px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 bg-slate-900 text-white shadow-md"/g,
      'className="px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"');

    content = content.replace(/<span className="bg-\[#f3df27\] text-\[#151936\] px-2 py-0\.5 rounded-lg text-xs font-semibold tracking-wide">/g,
      '<span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full text-meta-muted-strong">');

    content = content.replace(/<span className="bg-slate-200 text-slate-600 px-2 py-0\.5 rounded-lg text-xs font-semibold tracking-wide">/g,
      '<span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full text-meta-muted-strong">');

    content = content.replace(/className="px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200\/50"/g,
      'className="px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-400 hover:text-slate-900 hover:bg-white/45"');
  }

  // Replace active tab globally: remove text-body-primary, remove font-medium, etc.
  content = content.replace(/className="([^"]*text-body-primary[^"]*bg-\[#151936\][^"]*)"/g, (match, p1) => {
    const newClass = p1.replace(/\btext-body-primary\b/g, '')
      .replace(/\bfont-semibold\b/g, '')
      .replace(/\bfont-medium\b/g, '')
      .replace(/\bfont-bold\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return `className="${newClass}"`;
  });

  // Replace inactive tabs globally: remove text-body-primary
  content = content.replace(/className="([^"]*text-body-primary[^"]*text-slate-400[^"]*)"/g, (match, p1) => {
    const newClass = p1.replace(/\btext-body-primary\b/g, '')
      .replace(/\bfont-semibold\b/g, '')
      .replace(/\bfont-medium\b/g, '')
      .replace(/\bfont-bold\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return `className="${newClass}"`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
    changedCount++;
  }
}
console.log('Total files changed:', changedCount);
