const JWT_SECRET = process.env.JWT_SECRET || 'apple_style_secret_key';

const textEncoder = new TextEncoder();

// Helper: base64url encoding
function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Helper: base64url decoding
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Import signature key
async function getCryptoKey() {
  const keyBuf = textEncoder.encode(JWT_SECRET);
  return await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60 // 7 days
  };

  const encodedHeader = base64url(textEncoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(textEncoder.encode(JSON.stringify(fullPayload)));
  const tokenInput = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await getCryptoKey();
  const signatureBuf = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    textEncoder.encode(tokenInput)
  );

  const encodedSignature = base64url(signatureBuf);
  return `${tokenInput}.${encodedSignature}`;
}

export async function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signatureStr] = parts;
    const tokenInput = `${headerStr}.${payloadStr}`;

    const cryptoKey = await getCryptoKey();
    const signatureBuf = base64urlDecode(signatureStr);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBuf,
      textEncoder.encode(tokenInput)
    );

    if (!isValid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadStr)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export async function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  return await verifyToken(token);
}
