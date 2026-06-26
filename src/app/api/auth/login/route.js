import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { signToken } from '@/utils/jwt';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    const teachersPath = path.join(process.cwd(), 'data/teachers.json');
    const data = await fs.readFile(teachersPath, 'utf-8');
    const teachers = JSON.parse(data);
    const teacher = teachers.find(t => t.username === username);

    if (!teacher) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const token = signToken({ id: teacher.id, name: teacher.name });

    return NextResponse.json({
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name
      }
    });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
