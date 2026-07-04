import { getAuthUser } from '../jwt';
import * as kv from '../kv';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// 辅助函数：根据起止日期计算跨越的月份 ['YYYY-MM', ...]
function getMonthsInRange(startDate, endDate) {
  const [sYear, sMonth] = startDate.split('-').map(Number);
  const [eYear, eMonth] = endDate.split('-').map(Number);
  const result = [];
  let year = sYear, month = sMonth;
  while (year < eYear || (year === eYear && month <= eMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return result;
}

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
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!classId || !classIdRegex.test(classId)) {
    return new Response(JSON.stringify({ error: '参数格式错误' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
  if (startDate && !dateRegex.test(startDate)) {
    return new Response(JSON.stringify({ error: '参数格式错误' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
  if (endDate && !dateRegex.test(endDate)) {
    return new Response(JSON.stringify({ error: '参数格式错误' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  try {
    // 1. 获取班级数据以确定学生列表
    const classKey = `class:${user.id}:${classId}`;
    const classContent = await kv.get(env, classKey);
    if (!classContent) {
      return new Response(JSON.stringify({ error: '班级不存在' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
    const classData = JSON.parse(classContent);

    if (!classData || !Array.isArray(classData.students)) {
      return new Response(JSON.stringify({ error: '班级数据格式错误' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    const studentMap = {};
    const studentsList = classData.students;
    for (const student of studentsList) {
      if (student && student.id) {
        studentMap[student.id] = {
          id: student.id,
          name: student.name || '',
          monthlyCounts: {},
          totalCount: 0,
          records: []
        };
      }
    }

    // 2. 获取涉及的月份键名
    let targetMonths = [];
    if (startDate && endDate) {
      targetMonths = getMonthsInRange(startDate, endDate);
    } else {
      // 若没有提供完整的起止时间，则利用 list 找出该班级的所有月份 key
      const listResult = await kv.list(env, { prefix: `record:${classId}:` });
      const keys = Array.isArray(listResult?.keys) ? listResult.keys : [];
      targetMonths = keys.map(k => k.key.split(':')[2]);
    }

    // 3. 并发获取并解析各月的考勤记录
    const readPromises = targetMonths.map(async (yearMonth) => {
      const recordKey = `record:${classId}:${yearMonth}`;
      try {
        const content = await kv.get(env, recordKey);
        return content ? JSON.parse(content) : null;
      } catch (err) {
        console.error(`Error parsing monthly record for ${recordKey}:`, err);
        return null;
      }
    });

    const monthlyRecordsResults = (await Promise.all(readPromises)).filter(Boolean);

    // 4. 在内存中合并并按起止日期范围过滤
    for (const monthlyData of monthlyRecordsResults) {
      for (const [dateStr, dayRecord] of Object.entries(monthlyData)) {
        // 进行日期范围的过滤
        if (startDate && dateStr < startDate) continue;
        if (endDate && dateStr > endDate) continue;

        if (dayRecord && Array.isArray(dayRecord.attendance)) {
          for (const item of dayRecord.attendance) {
            if (item && item.studentId) {
              const sId = item.studentId;
              if (studentMap[sId]) {
                const status = !!item.status;
                studentMap[sId].records.push({ date: dateStr, status });

                if (status) {
                  studentMap[sId].totalCount += 1;
                  const month = dateStr.substring(0, 7); // 'YYYY-MM'
                  studentMap[sId].monthlyCounts[month] = (studentMap[sId].monthlyCounts[month] || 0) + 1;
                }
              }
            }
          }
        }
      }
    }

    // 5. 按照学生列表顺序返回结果
    const resultStudents = studentsList
      .filter(s => s && s.id)
      .map(s => studentMap[s.id]);

    return new Response(JSON.stringify({ students: resultStudents }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error querying attendance:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}
