import { getAuthUser } from '../jwt';
import * as kv from '../kv';
import * as xlsx from 'xlsx';

const classIdRegex = /^[a-zA-Z0-9_-]+$/;

export async function onRequest({ request, params, env }) {
  if (request.method !== 'GET' && request.method !== 'PUT') {
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

  let classData;
  const classKey = `class:${user.id}:${id}`;
  try {
    const fileContent = await kv.get(env, classKey);
    if (!fileContent) {
      return new Response(JSON.stringify({ error: '班级不存在' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
    classData = JSON.parse(fileContent);

    if (classData.teacherId !== user.id) {
      return new Response(JSON.stringify({ error: '无权访问该班级' }), {
        status: 403,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: '班级不存在' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  if (request.method === 'GET') {
    return new Response(JSON.stringify(classData), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  // PUT 方法逻辑
  try {
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ error: '无效的请求格式，请使用 FormData 提交' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    const className = formData.get('name');
    const file = formData.get('file');

    if (!className || className.trim() === '') {
      return new Response(JSON.stringify({ error: '班级名称不能为空' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    if (className.trim().length > 50) {
      return new Response(JSON.stringify({ error: '班级名称长度不能超过 50 个字符' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    let updatedStudents = Array.isArray(classData.students) ? classData.students : [];

    const hasFile = file && typeof file === 'object' && typeof file.size === 'number' && file.size > 0 && typeof file.arrayBuffer === 'function';
    if (hasFile) {
      const arrayBuffer = await file.arrayBuffer();
      let workbook;
      try {
        workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: 'array' });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Excel 文件解析失败' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return new Response(JSON.stringify({ error: 'Excel 文件没有工作表' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      if (!sheetData || sheetData.length === 0 || !sheetData[0]) {
        return new Response(JSON.stringify({ error: 'Excel 文件内容为空，未能解析到表头' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }

      const headers = sheetData[0];
      const seqNumIndex = headers.indexOf('序号');
      const nameIndex = headers.indexOf('姓名');

      if (seqNumIndex === -1 || nameIndex === -1) {
        return new Response(JSON.stringify({ error: 'Excel 文件格式错误，必须包含"序号"和"姓名"列' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }

      const seenSeqNums = new Set();
      const excelStudents = [];
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        const seqNum = row[seqNumIndex];
        const name = row[nameIndex];

        if (name === undefined || name === null || String(name).trim() === '') {
          continue;
        }

        let parsedSeqNum = Number(seqNum);
        if (isNaN(parsedSeqNum) || seqNum === undefined || seqNum === null || String(seqNum).trim() === '') {
          parsedSeqNum = i;
        }

        if (seenSeqNums.has(parsedSeqNum)) {
          return new Response(JSON.stringify({ error: 'Excel 文件中存在重复的序号，请检查后重新上传' }), {
            status: 400,
            headers: { 'content-type': 'application/json; charset=UTF-8' }
          });
        }
        seenSeqNums.add(parsedSeqNum);

        const trimmedName = String(name).trim().slice(0, 20);

        excelStudents.push({
          seqNum: parsedSeqNum,
          name: trimmedName
        });
      }

      const originalStudents = Array.isArray(classData.students) ? classData.students : [];

      // 第一阶段：精确姓名匹配
      const originalByName = new Map();
      for (const student of originalStudents) {
        if (!originalByName.has(student.name)) {
          originalByName.set(student.name, []);
        }
        originalByName.get(student.name).push(student);
      }

      const consumedOriginalIds = new Set();

      for (const excelStudent of excelStudents) {
        const matches = originalByName.get(excelStudent.name);
        if (matches && matches.length > 0) {
          const matched = matches.shift();
          excelStudent.id = matched.id;
          consumedOriginalIds.add(matched.id);
        }
      }

      // 第二阶段：序号继承（改名订正）
      const originalBySeqNum = new Map(originalStudents.map(s => [s.seqNum, s]));
      for (const excelStudent of excelStudents) {
        if (excelStudent.id) continue;

        const originalStudent = originalBySeqNum.get(excelStudent.seqNum);
        if (originalStudent && !consumedOriginalIds.has(originalStudent.id)) {
          excelStudent.id = originalStudent.id;
          consumedOriginalIds.add(originalStudent.id);
        } else {
          excelStudent.id = `s_${crypto.randomUUID().replace(/-/g, '')}`;
        }
      }

      // 第三阶段：安全保留（防丢失）
      const finalStudents = [...excelStudents];
      for (const originalStudent of originalStudents) {
        if (!consumedOriginalIds.has(originalStudent.id)) {
          finalStudents.push(originalStudent);
        }
      }

      finalStudents.sort((a, b) => a.seqNum - b.seqNum);
      updatedStudents = finalStudents;
    }

    const updatedClass = {
      ...classData,
      name: className.trim(),
      students: updatedStudents
    };

    await kv.put(env, classKey, JSON.stringify(updatedClass));

    return new Response(JSON.stringify({ success: true, class: updatedClass }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error updating class:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}


