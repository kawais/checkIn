import { getAuthUser } from '../jwt';
import * as kv from '../kv';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;

export async function onRequest({ request, params, env }) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  const user = await getAuthUser(env, request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权，请登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  const { id } = params;
  if (!id || !classIdRegex.test(id)) {
    return new Response(JSON.stringify({ error: '参数格式错误' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  try {
    const classKey = `class:${user.id}:${id}`;
    const fileContent = await kv.get(env, classKey);
    if (!fileContent) {
      return new Response(JSON.stringify({ error: '班级不存在' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
    const classData = JSON.parse(fileContent);

    if (classData.teacherId !== user.id) {
      return new Response(JSON.stringify({ error: '无权访问该班级' }), {
        status: 403,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    return new Response(JSON.stringify(classData), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: '班级不存在' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}
