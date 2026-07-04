import * as xlsx from 'xlsx';
import { getAuthUser } from '../../../src/utils/jwt';
import * as kv from '../kv';

export async function onRequest({ request, env }) {
  const user = await getAuthUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权，请登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  if (request.method === 'GET') {
    try {
      const listResult = await kv.list(env, { prefix: 'class:' + user.id + ':' });
      const keys = Array.isArray(listResult?.keys) ? listResult.keys : [];
      const readPromises = keys.map(async (item) => {
        const classContent = await kv.get(env, item.key);
        if (!classContent) return null;
        try {
          const classData = JSON.parse(classContent);
          return {
            id: classData.id,
            name: classData.name,
            studentCount: Array.isArray(classData.students) ? classData.students.length : 0
          };
        } catch (err) {
          console.error(`Error parsing class data for ${item.key}:`, err);
          return null;
        }
      });
      const classes = (await Promise.all(readPromises)).filter(Boolean);
      return new Response(JSON.stringify(classes), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    } catch (error) {
      console.error('Error fetching classes:', error);
      return new Response(JSON.stringify({ error: '服务器内部错误' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const formData = await request.formData();
      const className = formData.get('name');
      const file = formData.get('file');

      if (!className || className.trim() === '') {
        return new Response(JSON.stringify({ error: '班级名称不能为空' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }
      if (!file) {
        return new Response(JSON.stringify({ error: '请上传 Excel 文件' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=UTF-8' }
        });
      }

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

      const students = [];
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        const seqNum = row[seqNumIndex];
        const name = row[nameIndex];

        if (name === undefined || name === null || String(name).trim() === '') {
          continue;
        }

        const studentId = `s_${crypto.randomUUID().replace(/-/g, '')}`;
        let parsedSeqNum = Number(seqNum);
        if (isNaN(parsedSeqNum) || seqNum === undefined || seqNum === null || String(seqNum).trim() === '') {
          parsedSeqNum = i;
        }

        students.push({
          id: studentId,
          seqNum: parsedSeqNum,
          name: String(name).trim()
        });
      }

      const classId = `c_${crypto.randomUUID().replace(/-/g, '')}`;
      const newClass = {
        id: classId,
        teacherId: user.id,
        name: className.trim(),
        students
      };

      await kv.put(env, `class:${user.id}:${classId}`, JSON.stringify(newClass));

      return new Response(JSON.stringify({ success: true, class: newClass }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    } catch (error) {
      console.error('Error creating class:', error);
      return new Response(JSON.stringify({ error: '服务器内部错误' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=UTF-8' }
  });
}
