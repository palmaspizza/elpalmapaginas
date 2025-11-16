exports.handler = async () => {
  try {
    const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
    const r = await fetch(`${FIREBASE_DB_URL}/fcmTokensList.json`);
    const json = await r.json();
    const list = json ? Object.values(json) : [];
    return { statusCode: 200, body: JSON.stringify({ ok: true, usuarios: list }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, usuarios: [], error: String(e) }) };
  }
};