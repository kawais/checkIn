const getKV = (env) => {
  if (typeof globalThis.my_kv !== 'undefined') return globalThis.my_kv;
  if (env && env.my_kv) return env.my_kv;
  if (typeof my_kv !== 'undefined') return my_kv;
  throw new Error("Tencent EdgeOne KV namespace 'my_kv' binding is missing. Please bind your KV namespace as 'my_kv' in EdgeOne console.");
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
