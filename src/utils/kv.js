import fs from 'fs/promises';
import path from 'path';

// 检查是否在 EdgeOne Pages 生产环境下，如果是则使用全局 my_kv 变量
const isProduction = typeof globalThis.my_kv !== 'undefined';

// 动态获取数据存储的根目录，避免 ESM 静态导入提升导致的环境变量读取失效
const getBaseDataDir = () => process.env.KV_DATA_DIR || 'data';

/**
 * 将 KV Key 映射为本地文件路径
 */
function getLocalPath(key) {
  const parts = key.split(':');
  const baseDataDir = getBaseDataDir();
  if (parts[0] === 'teacher' && parts[1] === 'all') {
    return path.resolve(process.cwd(), baseDataDir, 'teachers.json');
  }
  if (parts[0] === 'class') {
    // class:${teacherId}:${classId}
    const classId = parts[2] || parts[1]; // 兼容扁平格式
    return path.resolve(process.cwd(), baseDataDir, 'classes', `${classId}.json`);
  }
  if (parts[0] === 'record') {
    // record:${classId}:${yearMonth}
    const classId = parts[1];
    const yearMonth = parts[2];
    return path.resolve(process.cwd(), baseDataDir, 'records', classId, `${yearMonth}.json`);
  }
  // 备用兜底路径
  return path.resolve(process.cwd(), baseDataDir, 'kv_fallback', `${key.replace(/:/g, '_')}.json`);
}

export async function get(key) {
  if (isProduction) {
    return await globalThis.my_kv.get(key);
  }
  try {
    const filePath = getLocalPath(key);
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function put(key, value) {
  if (isProduction) {
    return await globalThis.my_kv.put(key, value);
  }
  const filePath = getLocalPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf-8');
}

export async function deleteKey(key) {
  if (isProduction) {
    return await globalThis.my_kv.delete(key);
  }
  try {
    const filePath = getLocalPath(key);
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export { deleteKey as delete };

export async function list(options = {}) {
  if (isProduction) {
    return await globalThis.my_kv.list(options);
  }

  const { prefix = '' } = options;
  const parts = prefix.split(':');
  const type = parts[0];

  const keys = [];
  const baseDataDir = getBaseDataDir();

  if (type === 'class') {
    // prefix is "class:${teacherId}:" or "class:"
    const teacherId = parts[1];
    const classesDir = path.resolve(process.cwd(), baseDataDir, 'classes');
    try {
      const files = await fs.readdir(classesDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(classesDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data && typeof data === 'object' && data.id && data.teacherId) {
            if (!teacherId || data.teacherId === teacherId) {
              keys.push({ key: `class:${data.teacherId}:${data.id}` });
            }
          }
        } catch {}
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  } else if (type === 'record') {
    // prefix is "record:${classId}:"
    const classId = parts[1];
    const recordsDir = path.resolve(process.cwd(), baseDataDir, 'records', classId);
    try {
      const files = await fs.readdir(recordsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const yearMonth = path.basename(file, '.json');
        keys.push({ key: `record:${classId}:${yearMonth}` });
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  // 统一前缀过滤，保证本地行为与 EdgeOne KV 一致
  const filteredKeys = keys.filter(item => item.key.startsWith(prefix));
  return { keys: filteredKeys, complete: true };
}
