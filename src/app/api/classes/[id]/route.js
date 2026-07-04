import { NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/jwt';
import * as kv from '@/utils/kv';

export const runtime = 'edge';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;

export async function GET(req, { params }) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !classIdRegex.test(id)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    const classKey = `class:${user.id}:${id}`;
    const fileContent = await kv.get(classKey);
    if (!fileContent) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    const classData = JSON.parse(fileContent);

    if (classData.teacherId !== user.id) {
      return NextResponse.json({ error: '无权访问该班级' }, { status: 403 });
    }

    return NextResponse.json(classData);
  } catch (err) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }
}
