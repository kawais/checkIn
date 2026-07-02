import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

// 1. 设置测试环境下的临时数据根目录，以隔离测试数据
process.env.KV_DATA_DIR = 'data_test_temp';

import { get, put, delete as deleteKey, list } from '../src/utils/kv.js';

async function runTests() {
  console.log('Running KV ESM tests...');
  const tempDir = path.resolve(process.cwd(), process.env.KV_DATA_DIR);

  try {
    // 确保清理了可能存在的历史临时目录
    await fs.rm(tempDir, { recursive: true, force: true });

    // ==========================================
    // 1. 测试 class 类型 Key (put, get, list, delete)
    // ==========================================
    const classKey = 'class:test_teacher:test_c1';
    const testVal = JSON.stringify({ id: 'test_c1', name: 'Test Class', teacherId: 'test_teacher' });
    
    await put(classKey, testVal);
    
    const readVal = await get(classKey);
    assert.strictEqual(readVal, testVal, 'Get class key should return the exact string that was put');

    // 2. 测试 list 过滤 (匹配的前缀)
    let listResult = await list({ prefix: 'class:test_teacher:' });
    assert.ok(listResult.keys.some(k => k.key === classKey), 'List should contain the created class key');

    // 3. 测试 list 过滤 (不匹配的前缀)
    let unmatchedList = await list({ prefix: 'class:other_teacher:' });
    assert.ok(!unmatchedList.keys.some(k => k.key === classKey), 'List should filter out keys with different teacher prefix');

    // 4. 测试 delete
    await deleteKey(classKey);
    const deletedVal = await get(classKey);
    assert.strictEqual(deletedVal, null, 'Deleted class key should return null');

    // ==========================================
    // 2. 测试 teacher:all 类型 Key
    // ==========================================
    const teacherKey = 'teacher:all';
    const teacherVal = JSON.stringify([{ id: 't1', name: 'Teacher 1' }]);
    
    await put(teacherKey, teacherVal);
    const readTeacherVal = await get(teacherKey);
    assert.strictEqual(readTeacherVal, teacherVal, 'Get teacher:all should return correct value');
    
    await deleteKey(teacherKey);
    const deletedTeacherVal = await get(teacherKey);
    assert.strictEqual(deletedTeacherVal, null, 'Deleted teacher:all should return null');

    // ==========================================
    // 3. 测试 record 类型 Key (put, get, list, delete)
    // ==========================================
    const recordKey = 'record:test_class_1:2026-07';
    const recordVal = JSON.stringify({ attendance: [] });
    
    await put(recordKey, recordVal);
    const readRecordVal = await get(recordKey);
    assert.strictEqual(readRecordVal, recordVal, 'Get record should return correct value');

    // 测试 record 类型的 list
    const recordList = await list({ prefix: 'record:test_class_1:' });
    assert.ok(recordList.keys.some(k => k.key === recordKey), 'List record should contain the created record key');
    
    // 测试 record 类型的不匹配前缀 list
    const unmatchedRecordList = await list({ prefix: 'record:other_class:' });
    assert.ok(!unmatchedRecordList.keys.some(k => k.key === recordKey), 'List record should filter out record keys for other classes');

    await deleteKey(recordKey);
    const deletedRecordVal = await get(recordKey);
    assert.strictEqual(deletedRecordVal, null, 'Deleted record should return null');

    // ==========================================
    // 4. 健壮性测试: 损坏的 JSON 或不完整结构的 class 文件夹文件不应导致 list 崩溃
    // ==========================================
    const classDir = path.resolve(tempDir, 'classes');
    await fs.mkdir(classDir, { recursive: true });
    
    // 写入一个损坏的 JSON 文件
    await fs.writeFile(path.join(classDir, 'bad_class.json'), '{ invalid json }', 'utf-8');
    // 写入一个缺少 teacherId / id 结构的 JSON 文件
    await fs.writeFile(path.join(classDir, 'incomplete_class.json'), JSON.stringify({ id: 'inc_1' }), 'utf-8');
    
    // 运行 list 应该静默跳过这些错误，且不会崩溃
    const safeListResult = await list({ prefix: 'class:' });
    assert.strictEqual(safeListResult.keys.length, 0, 'Safe list should return 0 valid keys but not crash');

    console.log('All KV adapter tests passed successfully!');
  } finally {
    // 彻底清理测试生成的临时目录，保持工作区干净
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

runTests().catch(err => {
  console.error('KV tests failed:', err);
  process.exit(1);
});
