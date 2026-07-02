import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { getAuthUser } from '@/utils/jwt';
import * as kv from '@/utils/kv';

// GET: 获取当前老师的所有班级
export async function GET(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const listResult = await kv.list({ prefix: 'class:' + user.id + ':' });
    const keys = Array.isArray(listResult?.keys) ? listResult.keys : [];
    const readPromises = keys.map(async (item) => {
      const classContent = await kv.get(item.key);
      if (!classContent) return null;
      try {
        const classData = JSON.parse(classContent);
        return {
          id: classData.id,
          name: classData.name,
          studentCount: Array.isArray(classData.students) ? classData.students.length : 0
        };
      } catch (err) {
        console.error(`Error parsing class data for ${item.key}:`, err);
        return null;
      }
    });
    const classes = (await Promise.all(readPromises)).filter(Boolean);
    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST: 上传 Excel 创建班级
export async function POST(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const className = formData.get('name');
    const file = formData.get('file');

    if (!className || className.trim() === '') {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook;
    try {
      workbook = xlsx.read(buffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json({ error: 'Excel 文件解析失败' }, { status: 400 });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: 'Excel 文件没有工作表' }, { status: 400 });
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (!sheetData || sheetData.length === 0 || !sheetData[0]) {
      return NextResponse.json({ error: 'Excel 文件内容为空，未能解析到表头' }, { status: 400 });
    }

    const headers = sheetData[0];
    const seqNumIndex = headers.indexOf('序号');
    const nameIndex = headers.indexOf('姓名');

    if (seqNumIndex === -1 || nameIndex === -1) {
      return NextResponse.json({ error: 'Excel 文件格式错误，必须包含"序号"和"姓名"列' }, { status: 400 });
    }

    const students = [];
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (!row || row.length === 0) continue;

      const seqNum = row[seqNumIndex];
      const name = row[nameIndex];

      if (name === undefined || name === null || String(name).trim() === '') {
        continue;
      }

      const studentId = `s_${crypto.randomUUID().replace(/-/g, '')}`;
      let parsedSeqNum = Number(seqNum);
      if (isNaN(parsedSeqNum) || seqNum === undefined || seqNum === null || String(seqNum).trim() === '') {
        parsedSeqNum = i;
      }

      students.push({
        id: studentId,
        seqNum: parsedSeqNum,
        name: String(name).trim()
      });
    }

    const classId = `c_${crypto.randomUUID().replace(/-/g, '')}`;
    const newClass = {
      id: classId,
      teacherId: user.id,
      name: className.trim(),
      students
    };

    await kv.put(`class:${user.id}:${classId}`, JSON.stringify(newClass));

    return NextResponse.json({ success: true, class: newClass });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
