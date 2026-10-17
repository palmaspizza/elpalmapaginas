# Asistente de voz local

## 1. Identificar el sistema (no asumas nada)
```
cat /etc/os-release; echo $XDG_SESSION_TYPE; python3 --version; arecord -l
```
`XDG_SESSION_TYPE` debe ser `x11` para poder cerrar ventanas con `wmctrl`. En `wayland` abrir y reproducir funcionan, pero cerrar ventanas no se puede comprobar.

## 2. Instalar (Debian/Ubuntu/Zorin; en otras distros cambia `apt`)
```
sudo apt install -y python3-venv python3-pip espeak-ng mpv yt-dlp wmctrl pulseaudio-utils libportaudio2 unzip wget
mkdir -p ~/asistente && cd ~/asistente        # copia aquí los 4 archivos
python3 -m venv venv && ./venv/bin/pip install vosk sounddevice samsungtvws
wget https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip && unzip vosk-model-small-es-0.42.zip && mv vosk-model-small-es-0.42 modelo
```
Edita `config.json`: pon tu usuario en `model_path` y la IP de cada tele (fíjales IP fija en el router).

## 3. Probar a mano
`./venv/bin/python assistant.py` y abre http://127.0.0.1:8765. Cada tele pedirá en pantalla "Permitir" la primera vez; acéptalo (el token queda en `tv_<nombre>.token`).

## 4. Inicio automático
Archivo `~/.config/systemd/user/asistente.service`:
```
[Unit]
Description=Asistente de voz
[Service]
ExecStart=%h/asistente/venv/bin/python %h/asistente/assistant.py
EnvironmentFile=-%h/asistente/gemini.env
Restart=always
RestartSec=5
[Install]
WantedBy=default.target
```
`systemctl --user daemon-reload && systemctl --user enable --now asistente && loginctl enable-linger $USER`
Ver errores: `journalctl --user -u asistente -f`. Reiniciar: `systemctl --user restart asistente`.
Abre el navegador en `http://127.0.0.1:8765` al iniciar sesión (Aplicaciones de inicio, modo quiosco).

## 5. Gemini (opcional)
Crea `gemini.env` con `GEMINI_API_KEY=tu_clave` y `chmod 600 gemini.env`. Solo se envía el texto de frases que pasaron el filtro local y no entendió la regla local. Sin clave o sin Internet todo lo básico sigue funcionando. Los términos y límites gratuitos cambian: revísalos en el sitio de Google.

## 6. Pruebas mínimas
| Prueba | Esperado |
|---|---|
| "Ayer vi un video en YouTube" | Silencio |
| "Pon Luis Miguel" | Suena música; verificado por mpv |
| "Mejor pon Los Tigres del Norte" | Se detiene la anterior y suena la nueva (un solo mpv) |
| Repetir la misma frase en 4 s | Se ignora |
| "Abre YouTube en la tele" | Pregunta cuál tele |
| "Cállate" mientras habla | Se calla y cancela lo pendiente; la música sigue |
| "Detén todo" | Cancela pendientes y detiene música |
| "Cierra Facebook" sin abrir | "Facebook no estaba abierto" |
| Quitar Internet | Pausa, volumen y apps siguen; música nueva falla con aviso |
| Tele apagada | "No pude hablar con la tele…" |

## 7. Límites (importante)
- Nada de esto fue probado en hardware real por mí: hay que ejecutar la tabla anterior.
- Sin palabra de activación habrá falsos positivos y negativos; el filtro los reduce, no los elimina.
- Eco: el micrófono sigue activo mientras habla, pero solo con vocabulario de parada; sin cancelación de eco por hardware puede fallar. Sube un poco el micrófono y baja el volumen de la voz.
- Música solo en el computador (mpv + yt-dlp). En las teles: abrir YouTube/Netflix, volumen, silencio y encendido/apagado (puede variar según el modelo; no se puede confirmar el resultado). Encender una tele en reposo profundo puede requerir Wake-on-LAN (no incluido).
- Pendiente: confirmar modelos de las teles, "pon X y Y" como lista, y cerrar apps en teles.
