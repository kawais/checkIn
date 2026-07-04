// 获取 EdgeOne KV 绑定实例，优先读取 'my_kv'，如果未配置则抛出易读的错误指引
const getKvInstance = () => {
  if (typeof globalThis.my_kv !== 'undefined') {
    return globalThis.my_kv;
  }
  // 兼容其他可能的大写命名绑定
  if (typeof globalThis.KV !== 'undefined') {
    return globalThis.KV;
  }
  throw new Error(
    "Tencent EdgeOne KV namespace binding is missing. " +
    "Please ensure that you have created a KV Namespace in the EdgeOne Console, " +
    "and bound it to your Pages function environment under the Variable Name 'my_kv'."
  );
};

export async function get(key) {
  return await getKvInstance().get(key);
}

export async function put(key, value) {
  return await getKvInstance().put(key, value);
}

export async function deleteKey(key) {
  return await getKvInstance().delete(key);
}

export { deleteKey as delete };

export async function list(options = {}) {
  return await getKvInstance().list(options);
}
