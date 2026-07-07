const getKV = (env) => {
  // 1. 优先读取标准传入的 env.my_kv (符合 EdgeOne 官方规范的最佳实践)
  if (env && env.my_kv) {
    return env.my_kv;
  }
  // 2. 备用读取全局注入变量 (防呆兼容)
  if (typeof globalThis !== 'undefined' && globalThis.my_kv) {
    return globalThis.my_kv;
  }
  throw new Error(
    "Tencent EdgeOne KV namespace 'my_kv' binding is missing. " +
    "Please ensure that you have bound your KV namespace under the Variable Name 'my_kv' in the EdgeOne Console."
  );
};

export async function get(env, key) {
  return await getKV(env).get(key);
}

export async function put(env, key, value) {
  return await getKV(env).put(key, value);
}

export async function deleteKey(env, key) {
  return await getKV(env).delete(key);
}

export async function list(env, options = {}) {
  return await getKV(env).list(options);
}
