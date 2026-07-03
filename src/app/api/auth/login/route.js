import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signToken } from '@/utils/jwt';
import * as kv from '@/utils/kv';

function log(msg) {
  // if (process.env.NODE_ENV !== 'production') {
  console.log(`[${new Date().toISOString()}] ${msg}`);
  // }
}

export async function POST(req) {
  log('Login API POST started');
  try {
    const body = await req.json();
    const logBody = { ...body };
    if (logBody.password) logBody.password = '[REDACTED]';
    log(`Body parsed: ${JSON.stringify(logBody)}`);
    const { username, password } = body;

    if (!username || !password) {
      log('Username or password missing');
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    log(`Reading teachers data from KV`);
    const data = await kv.get('teacher:all');
    if (!data) {
      log('No teacher data found in KV');
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    log(`Teachers file read success, length: ${data.length}`);

    let teachers;
    try {
      teachers = JSON.parse(data);
    } catch (parseErr) {
      log(`Failed to parse teacher data: ${parseErr.message}`);
      return NextResponse.json({ error: '数据损坏，请联系管理员' }, { status: 500 });
    }
    const teacher = teachers.find(t => t.username === username);
    log(`Teacher found: ${teacher ? teacher.username : 'not found'}`);

    if (!teacher) {
      log('Teacher not found in DB');
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    log('Comparing password...');
    const isMatch = await bcrypt.compare(password, teacher.password);
    log(`Password compare match: ${isMatch}`);

    if (!isMatch) {
      log('Password mismatch');
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    log('Signing token...');
    const token = signToken({ id: teacher.id, name: teacher.name });
    log('Token signed successfully');

    return NextResponse.json({
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name
      }
    });
  } catch (error) {
    log(`Error caught: ${error.message}\nStack: ${error.stack}`);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
