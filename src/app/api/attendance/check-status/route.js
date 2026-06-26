import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

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
  const date = searchParams.get('date');

  if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    const recordFilePath = path.join(RECORDS_DIR, classId, `${date}.json`);
    await fs.access(recordFilePath);
    return NextResponse.json({ submitted: true });
  } catch (err) {
    return NextResponse.json({ submitted: false });
  }
}
