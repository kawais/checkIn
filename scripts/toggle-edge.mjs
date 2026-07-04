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

if (action === 'disable') {
  // 自动写入种子教师数据，以防本地登录测试缺失数据库物理文件
  const dataDir = path.resolve(process.cwd(), 'data');
  const teachersPath = path.resolve(dataDir, 'teachers.json');
  if (!fs.existsSync(teachersPath)) {
    fs.mkdirSync(dataDir, { recursive: true });
    const seedData = JSON.stringify([
      {
        "id": "t_1",
        "name": "张老师",
        "username": "admin",
        "password": "$2a$10$tkSlvqufNF/taoZaYj/LsOwfxlsyAgqf8u4/hwcm1caZMB0mSD0Fi"
      }
    ], null, 2);
    fs.writeFileSync(teachersPath, seedData, 'utf-8');
    console.log('Successfully seeded default teachers.json for local testing.');
  }
}

console.log(`Successfully completed toggle action: ${action}`);
