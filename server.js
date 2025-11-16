require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, '..')));
app.use(express.static(__dirname));

const usuarios = new Map();
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://comedorelnano-default-rtdb.firebaseio.com';

app.post('/guardar-token', (req, res) => {
  const { name, token } = req.body || {};
  if (!token) return res.status(400).json({ ok: false, error: 'Falta token' });
  const nombre = name || `Usuario-${String(usuarios.size + 1).padStart(2, '0')}`;
  usuarios.set(token, { name: nombre, token });
  fetch(`${FIREBASE_DB_URL}/fcmTokensList.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, token, ts: Date.now() })
  }).then(() => res.json({ ok: true })).catch(err => {
    res.json({ ok: true, warn: 'Guardado local ok, error al persistir en Firebase', error: String(err) });
  });
});

app.get('/usuarios', async (req, res) => {
  try {
    const r = await fetch(`${FIREBASE_DB_URL}/fcmTokensList.json`);
    const json = await r.json();
    const list = json ? Object.values(json) : [];
    // Fallback si la lista no existe: intentar la antigua ruta o memoria
    if (!list.length) {
      try {
        const r2 = await fetch(`${FIREBASE_DB_URL}/fcmTokens.json`);
        const j2 = await r2.json();
        const list2 = j2 ? Object.values(j2) : [];
        if (list2.length) return res.json({ ok: true, usuarios: list2 });
      } catch {}
    }
    return res.json({ ok: true, usuarios: list.length ? list : Array.from(usuarios.values()) });
  } catch (e) {
    const list = Array.from(usuarios.values());
    res.json({ ok: true, usuarios: list, warn: 'No se pudo leer Firebase' });
  }
});

app.post('/enviar-notificaciones', async (req, res) => {
  try {
    const { titulo, mensaje, tokens } = req.body || {};
    const registrationTokens = Array.isArray(tokens) && tokens.length ? tokens : Array.from(usuarios.keys());
    if (!registrationTokens.length) return res.json({ ok: false, error: 'No hay tokens' });

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) return res.json({ ok: false, warn: 'Falta FCM_SERVER_KEY. No se envió push.' });

    const body = {
      registration_ids: registrationTokens,
      notification: {
        title: titulo || 'Notificación',
        body: mensaje || '',
        icon: 'https://i.ibb.co/m5WDvjFm/imagen-2025-10-22-173714897.png',
        tag: 'taxi-reserva-aviso',
        click_action: '/',
        sound: 'default'
      },
      webpush: {
        fcm_options: { link: '/' },
        headers: { TTL: '4500' },
        notification: { requireInteraction: true }
      },
      data: {
        url: '/',
        title: titulo || 'Notificación',
        body: mensaje || ''
      }
    };

    const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`
      },
      body: JSON.stringify(body)
    });
    const text = await resp.text();
    let json = {};
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) return res.json({ ok: false, status: resp.status, resultado: json });
    res.json({ ok: true, resultado: json });
  } catch (err) {
    res.json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de notificaciones en puerto ${PORT}`);
});