import fs from 'fs';
import path from 'path';

const files = [
  'src/app/api/auth/login/route.js',
  'src/app/api/classes/route.js',
  'src/app/api/classes/[id]/route.js',
  'src/app/api/attendance/submit/route.js',
  'src/app/api/attendance/query/route.js',
  'src/app/api/attendance/check-status/route.js'
];

const action = process.argv[2];

if (action !== 'enable' && action !== 'disable') {
  console.error('Usage: node scripts/toggle-edge.mjs [enable|disable]');
  process.exit(1);
}

for (const relPath of files) {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  if (action === 'disable') {
    // 注释掉 export const runtime = 'edge';
    content = content.replace(
      /^(export\s+const\s+runtime\s*=\s*['"]edge['"];?)/m,
      '// $1'
    );
    console.log(`Disabled Edge runtime for: ${relPath}`);
  } else {
    // 恢复 export const runtime = 'edge';
    content = content.replace(
      /^\/\/\s*(export\s+const\s+runtime\s*=\s*['"]edge['"];?)/m,
      '$1'
    );
    console.log(`Enabled Edge runtime for: ${relPath}`);
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}
console.log(`Successfully completed toggle action: ${action}`);
