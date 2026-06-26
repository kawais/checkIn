import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');
const RECORDS_DIR = path.join(process.cwd(), 'data/records');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { classId, date, attendance } = body;

    if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    if (!Array.isArray(attendance)) {
      return NextResponse.json({ error: '请求体格式错误，必须包含 attendance 数组' }, { status: 400 });
    }

    const classFilePath = path.join(CLASSES_DIR, `${classId}.json`);
    try {
      await fs.access(classFilePath);
    } catch (err) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    const classRecordsDir = path.join(RECORDS_DIR, classId);
    await fs.mkdir(classRecordsDir, { recursive: true });

    const recordFilePath = path.join(classRecordsDir, `${date}.json`);
    const recordData = { date, attendance };

    await fs.writeFile(recordFilePath, JSON.stringify(recordData, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
