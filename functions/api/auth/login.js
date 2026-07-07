import bcrypt from 'bcryptjs';
import { signToken } from '../jwt';
import * as kv from '../kv';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  log('Login API POST started (functions)');
  try {
    const body = await request.json();
    const logBody = { ...body };
    if (logBody.password) logBody.password = '[REDACTED]';
    log(`Body parsed: ${JSON.stringify(logBody)}`);
    const { username, password } = body;

    if (!username || !password) {
      log('Username or password missing');
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    log(`Reading teachers data from KV`);
    const data = await kv.get(env, 'teacher:all');
    if (!data) {
      log('No teacher data found in KV');
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
    log(`Teachers file read success, length: ${data.length}`);

    let teachers;
    try {
      teachers = JSON.parse(data);
    } catch (parseErr) {
      log(`Failed to parse teacher data: ${parseErr.message}`);
      return new Response(JSON.stringify({ error: '数据损坏，请联系管理员' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
    const teacher = teachers.find(t => t.username === username);
    log(`Teacher found: ${teacher ? teacher.username : 'not found'}`);

    if (!teacher) {
      log('Teacher not found in DB');
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    log('Comparing password...');
    const isMatch = bcrypt.compareSync(password, teacher.password);
    log(`Password compare match: ${isMatch}`);

    if (!isMatch) {
      log('Password mismatch');
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    log('Signing token...');
    const token = await signToken(env, { id: teacher.id, name: teacher.name });
    log('Token signed successfully');

    return new Response(JSON.stringify({
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch (error) {
    log(`Error caught: ${error.message}\nStack: ${error.stack}`);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}
