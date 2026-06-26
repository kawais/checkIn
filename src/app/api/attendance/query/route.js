import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');
const RECORDS_DIR = path.join(process.cwd(), 'data/records');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!classId || !classIdRegex.test(classId)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }
  if (startDate && !dateRegex.test(startDate)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }
  if (endDate && !dateRegex.test(endDate)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    const classFilePath = path.join(CLASSES_DIR, `${classId}.json`);
    let classData;
    try {
      const fileContent = await fs.readFile(classFilePath, 'utf-8');
      classData = JSON.parse(fileContent);
    } catch (err) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (!classData || !Array.isArray(classData.students)) {
      return NextResponse.json({ error: '班级数据格式错误' }, { status: 400 });
    }

    const studentMap = {};
    const studentsList = classData.students;
    for (const student of studentsList) {
      if (student && student.id) {
        studentMap[student.id] = {
          id: student.id,
          name: student.name || '',
          monthlyCounts: {},
          totalCount: 0,
          records: []
        };
      }
    }

    const classRecordsDir = path.join(RECORDS_DIR, classId);
    let files = [];
    try {
      files = await fs.readdir(classRecordsDir);
    } catch (err) {
      files = [];
    }

    const targetFiles = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const dateStr = path.basename(file, '.json');
        return { file, dateStr };
      })
      .filter(({ dateStr }) => {
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
        return true;
      });

    const readPromises = targetFiles.map(async ({ file, dateStr }) => {
      const recordFilePath = path.join(classRecordsDir, file);
      try {
        const fileContent = await fs.readFile(recordFilePath, 'utf-8');
        const dayRecord = JSON.parse(fileContent);
        return { dateStr, dayRecord };
      } catch (err) {
        console.error(`Error reading daily record file ${file}:`, err);
        return null;
      }
    });

    const dayRecordsResults = await Promise.all(readPromises);

    for (const result of dayRecordsResults) {
      if (!result || !result.dayRecord) continue;
      const { dateStr, dayRecord } = result;

      if (Array.isArray(dayRecord.attendance)) {
        for (const item of dayRecord.attendance) {
          if (item && item.studentId) {
            const sId = item.studentId;
            if (studentMap[sId]) {
              const status = !!item.status;
              studentMap[sId].records.push({ date: dateStr, status });

              if (status) {
                studentMap[sId].totalCount += 1;
                const month = dateStr.substring(0, 7); // 'YYYY-MM'
                studentMap[sId].monthlyCounts[month] = (studentMap[sId].monthlyCounts[month] || 0) + 1;
              }
            }
          }
        }
      }
    }

    const resultStudents = studentsList
      .filter(s => s && s.id)
      .map(s => studentMap[s.id]);

    return NextResponse.json({ students: resultStudents });
  } catch (error) {
    console.error('Error querying attendance:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
