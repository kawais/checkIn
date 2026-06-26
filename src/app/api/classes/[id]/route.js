import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;

export async function GET(req, { params }) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !classIdRegex.test(id)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    const classFilePath = path.join(CLASSES_DIR, `${id}.json`);
    const fileContent = await fs.readFile(classFilePath, 'utf-8');
    const classData = JSON.parse(fileContent);

    if (classData.teacherId !== user.id) {
      return NextResponse.json({ error: '无权访问该班级' }, { status: 403 });
    }

    return NextResponse.json(classData);
  } catch (err) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }
}
