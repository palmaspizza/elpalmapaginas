#!/usr/bin/env python3
# Asistente de voz local. Solo escucha en 127.0.0.1. Sin comandos arbitrarios: solo acciones de ALLOWED.
import json, os, re, socket, subprocess, threading, time, queue, unicodedata, urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

D = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(D, "config.json")))
PORT = 8765
TVS = CFG.get("tvs", {})
SOCK = "/tmp/asistente-mpv.sock"
APPS = {"youtube": ("https://www.youtube.com", "111299001"),
        "facebook": ("https://www.facebook.com", None),
        "netflix": ("https://www.netflix.com", "3201907018807")}
ALLOWED = {"play", "pause", "resume", "stop_music", "next", "open_app", "close_app",
           "volume_up", "volume_down", "mute", "tv_power"}
STOPW = ["cállate", "silencio", "no", "nada", "déjalo", "olvídalo", "para", "basta",
         "detén", "todo", "cancela", "[unk]"]

STATE = {"status": "Escuchando", "msg": "Puedes pedirme que ponga música, abra YouTube o controle la tele.",
         "question": None, "music": None, "apps": {}, "last_act": 0, "last_artist": None, "offline": False}
L = threading.Lock()
SUBS = []
PEND = None          # pregunta pendiente: {"acts","exp","tries"}
GEN = 0              # generación: al cancelar sube y las acciones viejas no se ejecutan
LAST = ["", 0]       # anti-duplicados
LASTNU = [0]         # cooldown de "no entendí"
Q = queue.Queue()
SP = None
MP = None


def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)


def push(**k):
    with L:
        STATE.update(k)
        d = json.dumps(STATE)
    for q in list(SUBS): q.put(d)


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


# ---------- voz ----------
def speaking(): return SP is not None and SP.poll() is None


def stop_voice():
    if speaking(): SP.terminate()


def say(t):
    global SP
    stop_voice(); push(msg=t); log("DIGO:", t)
    try: SP = subprocess.Popen(["espeak-ng", "-v", "es", "-s", "140", t])
    except Exception as e: log("TTS falló:", e)


# ---------- ayudas de sistema ----------
def wins():
    try: return subprocess.run(["wmctrl", "-l"], capture_output=True, text=True, timeout=3).stdout.lower()
    except Exception: return None


def wait_win(name, present, sec):
    for _ in range(sec * 2):
        w = wins()
        if w is None: return None
        if (name in w) == present: return True
        time.sleep(0.5)
    return False


def open_app(app):
    w = wins()
    if w and app in w: push(apps={**STATE["apps"], app: True}); return f"{app.capitalize()} ya está abierto."
    subprocess.Popen(["xdg-open", APPS[app][0]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    r = wait_win(app, True, 12)
    push(apps={**STATE["apps"], app: bool(r)})
    if r: return f"Listo, {app.capitalize()} abierto."
    return f"Envié la orden para abrir {app.capitalize()}, pero no pude comprobar que se abrió."


def close_app(app):
    w = wins()
    if w is None: return "En este sistema no puedo cerrar ventanas. Ciérrala con la X."
    if app not in w: return f"{app.capitalize()} no estaba abierto."
    subprocess.run(["wmctrl", "-c", app], capture_output=True)
    r = wait_win(app, False, 6)
    a = dict(STATE["apps"]); a.pop(app, None); push(apps=a)
    return f"Listo, {app.capitalize()} cerrado." if r else f"Intenté cerrar {app.capitalize()}, pero sigue abierto. Ciérralo con la X."


def tvkey(d, key=None, app=None):
    try:
        from samsungtvws import SamsungTVWS
        c = TVS[d]
        t = SamsungTVWS(host=c["ip"], port=8002, token_file=os.path.join(D, f"tv_{d}.token"), name="Asistente", timeout=5)
        if app: t.run_app(APPS[app][1])
        else: t.send_key(key)
        return f"Envié la orden a la tele del {d}. No puedo comprobar el resultado."
    except Exception as e:
        log("TV error", d, e)
        return f"No pude hablar con la tele del {d}. Revisa que esté encendida."


def tv_app(d, app):
    if not APPS[app][1]: return f"En la tele no puedo abrir {app.capitalize()}."
    return tvkey(d, app=app)


def vol(d, i):
    if d == "computer":
        a = {"volume_up": "+10%", "volume_down": "-10%"}.get(i)
        c = ["pactl", "set-sink-volume", "@DEFAULT_SINK@", a] if a else ["pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle"]
        try: ok = subprocess.run(c, capture_output=True, timeout=4).returncode == 0
        except Exception: ok = False
        return "Listo." if ok else "No pude cambiar el volumen."
    return tvkey(d, {"volume_up": "KEY_VOLUP", "volume_down": "KEY_VOLDOWN", "mute": "KEY_MUTE"}[i])


# ---------- música (un único mpv: evita doble reproducción) ----------
def mpv(*c):
    try:
        s = socket.socket(socket.AF_UNIX); s.settimeout(2); s.connect(SOCK)
        s.sendall((json.dumps({"command": list(c)}) + "\n").encode())
        buf = b""
        while True:
            ch = s.recv(4096)
            if not ch: return None
            buf += ch
            for line in buf.split(b"\n"):
                try: d = json.loads(line)
                except Exception: continue
                if "error" in d: s.close(); return d
    except Exception: return None


def stop_music():
    global MP
    if MP is not None and MP.poll() is None:
        MP.terminate()
        try: MP.wait(3)
        except Exception:
            MP.kill()
            try: MP.wait(3)
            except Exception: pass
    ok = MP is None or MP.poll() is not None
    if ok: MP = None; push(music=None)
    return ok


def play(q):
    global MP
    if not stop_music(): return "No pude detener la música anterior. Di: detén todo."
    if os.path.exists(SOCK): os.remove(SOCK)
    push(status=f"Buscando {q}")
    MP = subprocess.Popen(["mpv", "--no-video", "--really-quiet", f"--input-ipc-server={SOCK}", f"ytdl://ytsearch10:{q}"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if MP.poll() is not None: break
        r = mpv("get_property", "path")
        if r and r.get("error") == "success":
            push(music={"artist": q, "verified": True}, last_artist=q)
            return f"Reproduciendo {q}."
        time.sleep(0.5)
    stop_music()
    return "No pude reproducir eso. Revisa la conexión a Internet."


def musicctl(i):
    if i == "stop_music":
        return "Música detenida." if stop_music() else "No pude detener la música."
    if MP is None or MP.poll() is not None: return "No hay música sonando."
    if i == "next": mpv("playlist-next"); return "Siguiente canción."
    mpv("set_property", "pause", i == "pause")
    r = mpv("get_property", "pause")
    ok = r and r.get("data") == (i == "pause")
    return ("Música en pausa." if i == "pause" else "Sigue la música.") if ok else "No pude confirmar el cambio."


def execute(a):
    i, d, app = a["intent"], a.get("dev") or "computer", a.get("app")
    if i == "play":
        if d != "computer": return "En la tele no puedo poner música sola. Puedo ponerla en el computador."
        return play(a["artist"])
    if i in ("pause", "resume", "stop_music", "next"): return musicctl(i)
    if i == "open_app": return open_app(app) if d == "computer" else tv_app(d, app)
    if i == "close_app": return close_app(app) if d == "computer" else "En la tele no puedo cerrar aplicaciones. Usa el control."
    if i in ("volume_up", "volume_down", "mute"): return vol(d, i)
    if i == "tv_power": return tvkey(d, "KEY_POWER")


def stop_all():
    global GEN, PEND
    GEN += 1; PEND = None
    while not Q.empty():
        try: Q.get_nowait()
        except queue.Empty: break
    stop_voice()
    ok = stop_music()
    push(question=None, status="Escuchando")
    return "Detuve todo lo que controlo." if ok else "No pude detener la música. Apaga el sonido del computador."


def worker():
    while True:
        g, acts = Q.get()
        out = []
        for a in acts:
            if g != GEN: break
            push(status="Haciendo lo que pediste")
            try: r = execute(a)
            except Exception as e: log("ERR", a, e); r = "No pude hacerlo."
            if g != GEN: break
            if r: out.append(r)
            push(last_act=time.time())
        if g == GEN:
            push(status="Escuchando")
            if out: say(" ".join(out))


# ---------- intérprete ----------
def devof(s):
    for k, c in TVS.items():
        for w in [k] + c.get("alias", []):
            if re.search(rf"\b{w}\b", s): return k
    if re.search(r"\b(computador|compu|pc|ordenador)\b", s): return "computer"
    if re.search(r"\b(tele|television|tv)\b", s): return "tv?"
    return None


def A(i, **k): return {"intent": i, **k}


SPLIT = re.compile(r"\b(?:y luego|y despues|luego|despues|y entonces)\b|\by (?=(?:abre|pon|cierra|busca|deten|para|apaga|sube|baja)\b)")
PLAY = re.compile(r"^(?:mejor )?(?:pon|ponme|poner|quiero escuchar|quiero oir|escucha|escuchar|reproduce|busca)\s+"
                  r"(?:unas |unos |una |un |algo de |la |el )?(?:canciones de |cancion de |musica de )?(.+)$")
TAIL = re.compile(r"\s+(?:en|por|a|de) (?:la |el )?(?:tele|television|computador|compu|pc|ordenador|comedor|pieza|cuarto)\b.*$")


def seg_parse(s):
    d = devof(s)
    m = re.search(r"\b(youtube|facebook|netflix)\b", s); app = m.group(1) if m else None
    if re.search(r"\b(cierra|cerrar|cierrame)\b", s) and app: return [A("close_app", app=app, dev=d)]
    if app and re.search(r"\b(abre|abrir|abreme|entra|pon|ponme|quiero ver)\b", s) and not re.search(r"\b(busca|musica)\b", s):
        return [A("open_app", app=app, dev=d)]
    if re.search(r"\b(sube|subele|mas alto)\b.*\b(volumen|tele|television|musica)\b|\b(sube|subele) (el )?volumen", s): return [A("volume_up", dev=d)]
    if re.search(r"\b(baja|bajale|mas bajo)\b.*\b(volumen|tele|television|musica)\b|\b(baja|bajale) (el )?volumen", s): return [A("volume_down", dev=d)]
    if re.search(r"\b(silencia|mute|quita el sonido)\b", s): return [A("mute", dev=d)]
    if re.search(r"\b(prende|enciende|apaga)\b.*\b(tele|television)\b", s): return [A("tv_power", dev=d)]
    if re.search(r"\b(otra|siguiente) cancion\b|\bcambia(la|lo)? de cancion\b", s):
        return [A("next")] if STATE["music"] else ([A("play", artist=STATE["last_artist"], dev=d)] if STATE["last_artist"] else [])
    if re.search(r"\b(continua|sigue|reanuda)\b", s): return [A("resume")]
    if re.search(r"\b(pausa|para)\b.*\b(musica|cancion|video)\b|^pausa$", s): return [A("pause")]
    if re.search(r"\b(deten|detener|apaga|quita)\b.*\b(musica|cancion)\b|\bya no quiero (escuchar|oir)\b|\bdeja de (escuchar|reproducir)\b", s):
        return [A("stop_music")]
    if re.search(r"\b(antes|anterior|escuchabamos)\b", s) and re.search(r"\b(pon|ponme|escucha)\b", s) and STATE["last_artist"]:
        return [A("play", artist=STATE["last_artist"], dev=d)]
    m = PLAY.match(s)
    if m:
        q = TAIL.sub("", m.group(1)).strip()
        if q in ("musica", "cancion", "canciones", "algo", ""): q = None
        elif re.search(r"\by\b", q) and re.search(r"\b(luis|tigres|los|las)\b", q) and q.count(" y ") == 1: q = q  # dos artistas: se trata como una lista
        return [A("play", artist=q, dev=d)]
    return []


def gemini(t):
    k = os.environ.get("GEMINI_API_KEY")
    if not k: return None
    ctx = {"musica": STATE["music"], "apps": list(STATE["apps"]), "ultimo_artista": STATE["last_artist"], "teles": list(TVS)}
    p = ("Eres el intérprete de un asistente para un adulto mayor. Convierte la frase en acciones. Responde SOLO JSON: "
         '{"actions":[{"intent":"play|pause|resume|stop_music|next|open_app|close_app|volume_up|volume_down|mute|tv_power",'
         '"artist":string|null,"app":"youtube|facebook|netflix"|null,"dev":"computer"|nombre_de_tele|"tv?"|null}],"ask":string|null}. '
         'Si la frase no es una orden al asistente devuelve {"actions":[]}. No inventes datos: si falta algo usa "ask" (pregunta corta). '
         f"Contexto: {json.dumps(ctx, ensure_ascii=False)}. Frase: {t}")
    body = {"contents": [{"parts": [{"text": p}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{CFG.get('gemini_model', 'gemini-2.5-flash')}:generateContent"
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", "x-goog-api-key": k})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=6))
        push(offline=False)
        return json.loads(r["candidates"][0]["content"]["parts"][0]["text"])
    except Exception as e:
        log("Gemini falló:", e); push(offline=True); return None


def clean(acts):
    out = []
    for a in acts or []:
        if not isinstance(a, dict) or a.get("intent") not in ALLOWED: continue
        app, d, ar = a.get("app"), a.get("dev"), a.get("artist")
        if app not in APPS: app = None
        if d not in TVS and d not in ("computer", "tv?"): d = None
        if isinstance(ar, str): ar = re.sub(r"[^\w \-.,'ñáéíóúü]", "", ar)[:80].strip() or None
        else: ar = None
        if a["intent"] in ("open_app", "close_app") and not app: continue
        out.append({"intent": a["intent"], "artist": ar, "app": app, "dev": d})
    return out


def need(acts):
    for a in acts:
        i, d = a["intent"], a.get("dev")
        if d == "tv?" or (i == "tv_power" and d not in TVS): return "dev"
    for a in acts:
        if a["intent"] == "play" and not a.get("artist"): return "artist"
    return None


def finish(acts):
    global PEND
    n = need(acts)
    if n:
        q = "¿En cuál: computador, " + ", ".join(TVS) + "?" if n == "dev" else "¿Qué quieres escuchar?"
        PEND = {"acts": acts, "exp": time.time() + 20, "tries": 0, "need": n}
        push(question=q, status="Necesito que me aclares algo"); say(q); return
    Q.put((GEN, acts))


def resolve(t):
    global PEND
    p = PEND; n = p["need"]
    if n == "dev":
        d = devof(t)
        if d is None and re.search(r"\b(aca|aqui)\b", t): d = "computer"
        if d in (None, "tv?"):
            p["tries"] += 1
            if p["tries"] >= 2: PEND = None; push(question=None, status="Escuchando"); say("Está bien, lo dejamos."); return
            say("No entendí. ¿Computador, " + ", ".join(TVS) + "?"); return
        for a in p["acts"]:
            if a.get("dev") in (None, "tv?") or a["intent"] == "tv_power": a["dev"] = d
    else:
        m = PLAY.match(t); q = TAIL.sub("", m.group(1) if m else t).strip()
        if not q: PEND = None; push(question=None, status="Escuchando"); return
        for a in p["acts"]:
            if a["intent"] == "play" and not a.get("artist"): a["artist"] = q
    PEND = None; push(question=None, status="Escuchando")
    finish(p["acts"])


def urgent(t):
    """Interrupciones: se procesan siempre, incluso mientras el asistente habla."""
    global GEN, PEND
    if re.fullmatch(r"(no )?(nada|dejalo|olvidalo|hagas nada|mejor no|me equivoque|gracias)|no|ya no|no hagas nada|cancela", t):
        GEN += 1; PEND = None; stop_voice(); push(question=None, status="Escuchando"); return True
    if re.search(r"\b(callate|calles|calla|silencio)\b", t) or t in ("basta", "para"):
        stop_voice(); GEN += 1; PEND = None; push(question=None, status="Escuchando"); return True
    if re.search(r"\b(deten|para|detener|apaga) todo\b|\bdeja de reproducir\b", t):
        say(stop_all()); return True
    return False


CMD = re.compile(r"^(por favor |a ver |oye |mira )?(pon|ponme|abre|abreme|cierra|cierrame|busca|quiero|quisiera|puedes|podrias|dame|escucha|"
                 r"reproduce|sube|subele|baja|bajale|apaga|enciende|prende|deten|para|pausa|continua|sigue|reanuda|cambia|mejor|otra|quita|"
                 r"ya no|no|eso|lo otro|el otro|ahi)\b")
WEAK = re.compile(r"^(no|eso|lo otro|el otro|ahi|mejor|ya no|otra)\b")


def handle(text, conf=1.0, only_urgent=False):
    global PEND
    t = norm(text); now = time.time()
    if not t: return
    if t == LAST[0] and now - LAST[1] < 4: return
    LAST[:] = [t, now]
    log("OÍ:", t, round(conf, 2))
    if urgent(t) or only_urgent: return
    if PEND and now > PEND["exp"]: PEND = None; push(question=None, status="Escuchando")
    if PEND: resolve(t); return
    ctx = now - STATE["last_act"] < 60
    if not CMD.match(t) or len(t.split()) > 14: return                 # conversación normal: silencio
    if WEAK.match(t) and not ctx: return
    if conf < 0.55 and not ctx: return
    push(status="Entendiendo tu petición")
    if t.startswith("no ") and len(t.split()) > 2: t = re.sub(r"^no( mejor)? ", "", t)
    acts = [a for s in SPLIT.split(t) if s and s.strip() for a in seg_parse(s.strip())]
    if not acts:
        g = gemini(t)
        if g:
            acts = clean(g.get("actions"))
            if not acts and g.get("ask") and isinstance(g["ask"], str): push(status="Escuchando"); say(g["ask"][:120]); return
    if not acts:
        push(status="Escuchando")
        if now - LASTNU[0] > 20: LASTNU[0] = now; say("No entendí bien. ¿Qué quieres que haga?")
        return
    finish(acts)


# ---------- micrófono ----------
def listen():
    from vosk import Model, KaldiRecognizer, SetLogLevel
    import sounddevice as sd
    SetLogLevel(-1)
    m = Model(CFG["model_path"])
    main = KaldiRecognizer(m, 16000); main.SetWords(True)
    stopr = KaldiRecognizer(m, 16000, json.dumps(STOPW, ensure_ascii=False))
    aq = queue.Queue(maxsize=100)

    def cb(d, f, t, s):
        try: aq.put_nowait(bytes(d))
        except queue.Full: pass

    prev, resume = False, 0
    with sd.RawInputStream(samplerate=16000, blocksize=4000, dtype="int16", channels=1, callback=cb):
        push(status="Escuchando")
        while True:
            d = aq.get(timeout=5)                       # si no llega audio => excepción => reintento
            sp = speaking()
            if prev and not sp:                         # terminó de hablar: descartar eco
                while not aq.empty(): aq.get_nowait()
                main.Reset(); stopr.Reset(); resume = time.time() + 0.6; continue
            prev = sp
            r = stopr if sp else main
            if r.AcceptWaveform(d):
                res = json.loads(r.Result()); text = res.get("text", "").strip()
                if not text or text == "[unk]": continue
                if sp: handle(text, 1.0, only_urgent=True)
                elif time.time() > resume:
                    w = [x.get("conf", 1) for x in res.get("result", [])]
                    handle(text, sum(w) / len(w) if w else 1.0)


def listen_forever():
    while True:
        try: listen()
        except Exception as e:
            log("MIC error:", e)
            push(status="Sin micrófono", msg="No puedo escuchar. Revisa el micrófono.")
            time.sleep(10)


# ---------- servidor local ----------
OK_HOSTS = (f"127.0.0.1:{PORT}", f"localhost:{PORT}")


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        if self.headers.get("Host") not in OK_HOSTS: self.send_error(403); return
        if self.path == "/events":
            self.send_response(200); self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache"); self.end_headers()
            q = queue.Queue(); SUBS.append(q); q.put(json.dumps(STATE))
            try:
                while True:
                    try: self.wfile.write(f"data: {q.get(timeout=15)}\n\n".encode())
                    except queue.Empty: self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except Exception: pass
            finally: SUBS.remove(q)
        else:
            b = open(os.path.join(D, "index.html"), "rb").read()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        if self.headers.get("Host") not in OK_HOSTS or self.headers.get("Origin") not in (None, f"http://{self.headers.get('Host')}"):
            self.send_error(403); return
        if self.path == "/stop": say(stop_all())
        self.send_response(204); self.end_headers()


if __name__ == "__main__":
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=listen_forever, daemon=True).start()
    log(f"Interfaz: http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
