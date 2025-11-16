exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const titulo = body && body.titulo;
    const mensaje = body && body.mensaje;
    const tokens = body && body.tokens;
    const registrationTokens = Array.isArray(tokens) && tokens.length ? tokens : [];
    if (!registrationTokens.length) return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No hay tokens' }) };

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) return { statusCode: 200, body: JSON.stringify({ ok: false, warn: 'Falta FCM_SERVER_KEY' }) };

    const fcmBody = {
      registration_ids: registrationTokens,
      notification: {
        title: titulo || 'Notificación',
        body: mensaje || '',
        icon: 'https://i.ibb.co/m5WDvjFm/imagen-2025-10-22-173714897.png',
        tag: 'taxi-reserva-aviso',
        click_action: '/',
        sound: 'default'
      },
      webpush: { fcm_options: { link: '/' }, headers: { TTL: '4500' }, notification: { requireInteraction: true } },
      data: { url: '/', title: titulo || 'Notificación', body: mensaje || '' }
    };

    const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `key=${serverKey}` },
      body: JSON.stringify(fcmBody)
    });
    const text = await resp.text();
    let json = {};
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) return { statusCode: 200, body: JSON.stringify({ ok: false, status: resp.status, resultado: json }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, resultado: json }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};