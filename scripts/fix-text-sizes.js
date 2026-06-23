const fs = require('fs');
const path = require('path');

const targets = [
  'src/components/finance/finance-operations-scheduler.tsx',
  'src/components/finance/finance-overview-scaffold.tsx',
  'src/components/finance/commissions-board.tsx',
  'src/components/finance/payroll-board.tsx'
];

const replacers = [
  // Exact class replacements for arbitrary px sizes
  { regex: /text-\[12\.5px\]/g, replacement: 'text-sm' },
  { regex: /text-\[8\.5px\]/g, replacement: 'body-sm' },
  { regex: /sm:text-\[26px\]/g, replacement: 'sm:text-3xl' },
  { regex: /text-\[14px\]/g, replacement: 'body-md' },
  { regex: /text-\[11\.5px\]/g, replacement: 'body-sm' },
  { regex: /text-\[16px\]/g, replacement: 'text-lg' },
  { regex: /text-\[10px\]/g, replacement: 'body-sm' },
  { regex: /text-\[32px\]/g, replacement: 'text-4xl' },
  { regex: /text-\[11px\]/g, replacement: 'body-sm' },
  { regex: /text-\[12px\]/g, replacement: 'body-sm' },
  { regex: /text-\[13px\]/g, replacement: 'body-md' },
  { regex: /text-\[13\.5px\]/g, replacement: 'body-md' },
  { regex: /text-\[10\.5px\]/g, replacement: 'body-sm' },
  { regex: /text-\[9px\]/g, replacement: 'body-sm' },
  { regex: /text-\[17px\]/g, replacement: 'text-lg' },
  { regex: /text-\[24px\]/g, replacement: 'text-2xl' },
  { regex: /text-\[20px\]/g, replacement: 'text-xl' },
  { regex: /text-\[30px\]/g, replacement: 'text-4xl' },

  // Parent containers in commissions-board that incorrectly use text-xs
  { regex: /space-y-6 text-slate-700 text-xs/g, replacement: 'space-y-6 text-slate-700 text-sm' },
  { regex: /space-y-4 text-xs text-slate-750/g, replacement: 'space-y-4 text-sm text-slate-750' },
  { regex: /space-y-4 text-xs text-slate-700/g, replacement: 'space-y-4 text-sm text-slate-700' }
];

const workspaceRoot = path.resolve(__dirname, '..');

targets.forEach((relPath) => {
  const fullPath = path.join(workspaceRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;

  replacers.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[FIXED] Standardized typography tokens in: ${relPath}`);
  } else {
    console.log(`[NO CHANGES] Already clean or no matches in: ${relPath}`);
  }
});

console.log('Typography standardization script run complete.');
