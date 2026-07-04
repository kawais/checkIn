import { NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/jwt';
import * as kv from '@/utils/kv';

export const runtime = 'edge';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');

  if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  const yearMonth = date.substring(0, 7);

  // 校验当前教师对该班级是否拥有归属权，防止水平越权
  const classKey = `class:${user.id}:${classId}`;
  const classExists = await kv.get(classKey);
  if (!classExists) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }

  try {
    const recordStr = await kv.get(`record:${classId}:${yearMonth}`);
    if (recordStr) {
      const monthlyRecords = JSON.parse(recordStr);
      if (monthlyRecords[date]) {
        return NextResponse.json({ submitted: true });
      }
    }
    return NextResponse.json({ submitted: false });
  } catch (err) {
    console.error('Error checking status:', err);
    return NextResponse.json({ submitted: false });
  }
}

