import { getAuthUser } from '../jwt';
import * as kv from '../kv';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  // 1. 用户登录鉴权
  const user = await getAuthUser(env, request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权，请登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  try {
    const { classId, date } = await request.json();

    // 2. 参数格式校验
    if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
      return new Response(JSON.stringify({ error: '参数格式错误' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    // 3. 校验班级归属权，防止越权删除
    const classKey = `class:${user.id}:${classId}`;
    const classData = await kv.get(env, classKey);
    if (!classData) {
      return new Response(JSON.stringify({ error: '班级不存在或无操作权限' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    // 4. 清理逻辑：获取该班级所有的月份记录
    const listResult = await kv.list(env, { prefix: `record:${classId}:` });
    const keys = Array.isArray(listResult?.keys) ? listResult.keys.map(k => k.name) : [];

    const targetYearMonth = date.substring(0, 7); // 比如 "2026-01"

    for (const key of keys) {
      // 提取 key 中的年份月份：record:classId:YYYY-MM -> YYYY-MM
      const parts = key.split(':');
      if (parts.length < 3) continue;
      const keyYearMonth = parts[2];

      // 如果当前 key 对应的月份大于我们要清理的截止日期所在的月份，直接跳过不处理
      if (keyYearMonth > targetYearMonth) {
        continue;
      }

      // 获取该月份的数据
      const content = await kv.get(env, key);
      if (!content) continue;

      let monthlyRecords = {};
      try {
        monthlyRecords = JSON.parse(content);
      } catch (e) {
        console.error(`解析 ${key} 失败:`, e);
        continue;
      }

      // 遍历日期并删除符合条件的记录
      let hasChange = false;
      for (const dayDate of Object.keys(monthlyRecords)) {
        if (dayDate <= date) {
          delete monthlyRecords[dayDate];
          hasChange = true;
        }
      }

      if (hasChange) {
        if (Object.keys(monthlyRecords).length === 0) {
          // 该月数据全部被删除，清空这个 KV 键以节省空间
          await kv.deleteKey(env, key);
        } else {
          // 重新写回 KV
          await kv.put(env, key, JSON.stringify(monthlyRecords));
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error clearing attendance:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误', e: error }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}
