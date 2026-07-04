import { getAuthUser } from '../../../src/utils/jwt';
import * as kv from '../kv';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  const user = await getAuthUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权，请登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');

  if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
    return new Response(JSON.stringify({ error: '参数格式错误' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  const yearMonth = date.substring(0, 7);

  // 校验当前教师对该班级是否拥有归属权，防止水平越权
  const classKey = `class:${user.id}:${classId}`;
  const classExists = await kv.get(env, classKey);
  if (!classExists) {
    return new Response(JSON.stringify({ error: '班级不存在' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  try {
    const recordStr = await kv.get(env, `record:${classId}:${yearMonth}`);
    if (recordStr) {
      const monthlyRecords = JSON.parse(recordStr);
      if (monthlyRecords[date]) {
        return new Response(JSON.stringify({ submitted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }
    }
    return new Response(JSON.stringify({ submitted: false }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch (err) {
    console.error('Error checking status:', err);
    return new Response(JSON.stringify({ submitted: false }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}
