exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const titulo = body.titulo || 'Notificación';
    const mensaje = body.mensaje || '';
    const token = body.token || '';
    const tokens = Array.isArray(body.tokens) ? body.tokens : (token ? [token] : []);

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, warn: 'Falta FCM_SERVER_KEY' }) };
    }

    if (!tokens.length) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No hay tokens' }) };
    }

    const payload = {
      registration_ids: tokens,
      notification: {
        title: titulo,
        body: mensaje,
        sound: 'default'
      },
      webpush: { fcm_options: { link: '/' } },
      data: { url: '/', title: titulo, body: mensaje }
    };

    const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `key=${serverKey}` },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    let parsed = {};
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { statusCode: 200, body: JSON.stringify({ ok: resp.ok, status: resp.status, result: parsed }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
