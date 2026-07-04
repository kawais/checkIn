import { NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/jwt';
import * as kv from '@/utils/kv';

// export const runtime = 'edge';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { classId, date, attendance } = body;

    if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    if (!Array.isArray(attendance)) {
      return NextResponse.json({ error: '请求体格式错误，必须包含 attendance 数组' }, { status: 400 });
    }

    // 校验班级是否存在
    const classKey = `class:${user.id}:${classId}`;
    const classData = await kv.get(classKey);
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    // 计算写入的 KV 月度聚合记录 Key
    const yearMonth = date.substring(0, 7); // 提取 'YYYY-MM'
    const recordKey = `record:${classId}:${yearMonth}`;

    // 获取并更新该月份的记录
    const existingRecordsStr = await kv.get(recordKey);
    let monthlyRecords = {};
    if (existingRecordsStr) {
      try {
        monthlyRecords = JSON.parse(existingRecordsStr);
      } catch (parseErr) {
        console.error(`[Warning] Monthly record JSON parse failed for key ${recordKey}, resetting:`, parseErr);
        monthlyRecords = {}; // 降级容错，重置为空对象以保证后续可以打卡
      }
    }

    // 写入或更新当前日期的记录
    monthlyRecords[date] = { date, attendance };

    // 保存回 KV
    await kv.put(recordKey, JSON.stringify(monthlyRecords));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

