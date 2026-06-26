const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function generateExcel() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const data = [
    { '序号': 1, '姓名': '学生甲' },
    { '序号': 2, '姓名': '学生乙' },
    { '序号': 3, '姓名': '学生丙' }
  ];

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, '学生花名册');

  const outputPath = path.join(fixturesDir, 'students.xlsx');
  xlsx.writeFile(workbook, outputPath);
  console.log('Successfully generated test excel at:', outputPath);
}

generateExcel();
