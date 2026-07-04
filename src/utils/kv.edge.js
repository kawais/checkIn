// 生产环境：使用全局 my_kv 变量
export async function get(key) {
  return await globalThis.my_kv.get(key);
}

export async function put(key, value) {
  return await globalThis.my_kv.put(key, value);
}

export async function deleteKey(key) {
  return await globalThis.my_kv.delete(key);
}

export { deleteKey as delete };

export async function list(options = {}) {
  return await globalThis.my_kv.list(options);
}
