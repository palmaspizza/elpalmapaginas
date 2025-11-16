exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const name = body && body.name;
    const token = body && body.token;
    if (!token) return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Falta token' }) };
    const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
    const nombre = name || 'Usuario';
    const resp = await fetch(`${FIREBASE_DB_URL}/fcmTokensList.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, token, ts: Date.now() })
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};