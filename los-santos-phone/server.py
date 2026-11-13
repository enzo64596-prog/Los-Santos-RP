"""Los Santos Phone - multiplayer RP phone, FastAPI + SQLite.
Run: pip install -r requirements.txt && python server.py
"""
import asyncio
import hashlib
import io
import json
import os
import re
import secrets
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

BASE = Path(__file__).resolve().parent
DB = Path(os.getenv('RP_DATABASE', str(BASE / 'rp_phone.db')))
UPLOADS = Path(os.getenv('RP_UPLOADS', str(BASE / 'uploads')))
UPLOADS.mkdir(parents=True, exist_ok=True)
ENTRY_CODE = os.getenv('RP_ENTRY_CODE', '1245')
MOD_CODE = os.getenv('RP_MOD_CODE', '2007')
START_MONEY = max(0, int(os.getenv('RP_START_MONEY', '5000')))
TZ = timezone.utc

app = FastAPI(title='Los Santos Phone RP', docs_url=None, redoc_url=None)
app.mount('/static', StaticFiles(directory=str(BASE / 'static')), name='static')


@contextmanager
def db():
    conn = sqlite3.connect(DB, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA busy_timeout=15000')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.execute('PRAGMA journal_mode=WAL')
        con.executescript('''
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE, rp_name TEXT NOT NULL, age INTEGER NOT NULL,
            gender TEXT NOT NULL, bio TEXT NOT NULL, experience TEXT NOT NULL,
            gamertag TEXT NOT NULL, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL,
            balance INTEGER NOT NULL DEFAULT 0, job TEXT NOT NULL DEFAULT 'Sans emploi',
            banned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL, mod_until TEXT
        );
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            phone TEXT NOT NULL, label TEXT NOT NULL, UNIQUE(owner_id, phone)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL REFERENCES players(id),
            receiver_id INTEGER NOT NULL REFERENCES players(id), body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, read_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id, receiver_id, id);
        CREATE INDEX IF NOT EXISTS idx_msg_rec ON messages(receiver_id, sender_id, id);
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT, caller_id INTEGER NOT NULL REFERENCES players(id),
            callee_id INTEGER NOT NULL REFERENCES players(id),
            status TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            answered_at TEXT, ended_at TEXT
        );
        CREATE TABLE IF NOT EXISTS bank_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER REFERENCES players(id),
            to_id INTEGER REFERENCES players(id), amount INTEGER NOT NULL, memo TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS job_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL REFERENCES players(id),
            job TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS app_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL REFERENCES players(id),
            name TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS custom_apps (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL,
            published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            filename TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS settings (
            player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
            ringtone TEXT NOT NULL DEFAULT 'Neon', notifications INTEGER NOT NULL DEFAULT 1,
            sounds INTEGER NOT NULL DEFAULT 1, wallpaper TEXT NOT NULL DEFAULT 'violet'
        );
        CREATE TABLE IF NOT EXISTS admin_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id INTEGER NOT NULL REFERENCES players(id), target_id INTEGER REFERENCES players(id),
            action TEXT NOT NULL, detail TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ''')


init_db()


def error(status, message):
    raise HTTPException(status_code=status, detail=message)


def now():
    return datetime.now(TZ).strftime('%Y-%m-%d %H:%M:%S')


def hash_pin(pin, salt):
    return hashlib.pbkdf2_hmac('sha256', pin.encode(), bytes.fromhex(salt), 210000).hex()


def safe_text(val, max_len=100):
    return str(val or '').strip()[:max_len]


def check_pin(pin):
    return isinstance(pin, str) and bool(re.fullmatch(r'\d{4,10}', pin))


def check_phone(phone):
    digits = re.sub(r'[^0-9]', '', str(phone or ''))
    if len(digits) == 7 and digits.startswith('555'):
        return '555-' + digits[3:]
    return str(phone or '').strip()


def public_user(row):
    return {
        'id': row['id'], 'phone': row['phone'], 'rp_name': row['rp_name'],
        'age': row['age'], 'gender': row['gender'], 'bio': row['bio'],
        'experience': row['experience'], 'gamertag': row['gamertag'],
        'balance': row['balance'], 'job': row['job'], 'banned': bool(row['banned']),
        'created_at': row['created_at'],
    }


def short_user(row):
    return {'id': row['id'], 'phone': row['phone'], 'rp_name': row['rp_name'], 'gamertag': row['gamertag']}


def auth_token(request: Request):
    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        error(401, 'Connexion nécessaire.')
    return authorization[7:]


def session_for(token, require_mod=False):
    if not token:
        error(401, 'Connexion nécessaire.')
    with db() as con:
        row = con.execute('''
          SELECT p.*, s.mod_until, s.token_hash, s.expires_at
          FROM sessions s JOIN players p ON p.id=s.player_id
          WHERE s.token_hash=? AND s.expires_at>?''',
          (hashlib.sha256(token.encode()).hexdigest(), now())).fetchone()
        if not row:
            error(401, 'Session expirée : reconnecte-toi.')
        if row['banned']:
            error(403, 'Ce compte a été banni du serveur RP.')
        if require_mod and (not row['mod_until'] or row['mod_until'] <= now()):
            error(403, 'Accès modérateur verrouillé.')
        return row


def current(request, require_mod=False):
    return session_for(auth_token(request), require_mod=require_mod)


def player_by_phone(con, phone):
    return con.execute('SELECT * FROM players WHERE phone=?', (check_phone(phone),)).fetchone()


def audit(con, actor_id, target_id, action, detail=''):
    con.execute('INSERT INTO admin_actions(actor_id,target_id,action,detail) VALUES(?,?,?,?)',
                (actor_id, target_id, action, detail[:300]))


class Realtime:
    def __init__(self):
        self.people = defaultdict(set)

    async def send(self, uid, event):
        for socket in list(self.people.get(uid, [])):
            try:
                await socket.send_json(event)
            except Exception:
                self.people[uid].discard(socket)

    async def mods(self, event):
        with db() as con:
            rows = con.execute('''SELECT DISTINCT player_id FROM sessions
                 WHERE mod_until>? AND expires_at>?''', (now(), now())).fetchall()
        for row in rows:
            await self.send(row['player_id'], event)


live = Realtime()


@app.get('/')
def home():
    return FileResponse(BASE / 'static' / 'index.html')


@app.get('/health')
def health():
    return {'ok': True}


@app.post('/api/entry')
def entry(data: dict):
    if not secrets.compare_digest(str(data.get('code', '')), ENTRY_CODE):
        error(403, 'Code de téléphone incorrect.')
    return {'ok': True}


@app.post('/api/register')
def register(data: dict):
    if not secrets.compare_digest(str(data.get('entry_code', '')), ENTRY_CODE):
        error(403, 'Code d’accès incorrect.')
    rp_name = safe_text(data.get('rp_name'), 50)
    gamertag = safe_text(data.get('gamertag'), 45)
    bio = safe_text(data.get('bio'), 1000)
    experience = safe_text(data.get('experience'), 600)
    gender = safe_text(data.get('gender'), 30)
    pin = str(data.get('pin', ''))
    try:
        age = int(data.get('age'))
    except (ValueError, TypeError):
        age = 0
    if len(rp_name) < 2 or len(gamertag) < 2 or age < 10 or age > 120 or not bio or not experience or gender not in ('Masculin', 'Féminin', 'Autre'):
        error(400, 'Complète tous les champs du personnage (âge RP de 10 à 120 ans).')
    if not check_pin(pin):
        error(400, 'Choisis un code PIN personnel de 4 à 10 chiffres.')
    salt = secrets.token_hex(16)
    token = secrets.token_urlsafe(40)
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        cur = con.execute('''INSERT INTO players(phone,rp_name,age,gender,bio,experience,gamertag,pin_salt,pin_hash,balance)
             VALUES(NULL,?,?,?,?,?,?,?,?,?)''', (rp_name, age, gender, bio, experience, gamertag, salt, hash_pin(pin, salt), START_MONEY))
        uid = cur.lastrowid
        phone = f'555-{uid + 99:04d}'
        con.execute('UPDATE players SET phone=? WHERE id=?', (phone, uid))
        con.execute('INSERT INTO settings(player_id) VALUES(?)', (uid,))
        con.execute('INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)',
                    (hashlib.sha256(token.encode()).hexdigest(), uid, (datetime.now(TZ) + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')))
        user = con.execute('SELECT * FROM players WHERE id=?', (uid,)).fetchone()
    return {'token': token, 'user': public_user(user)}


@app.post('/api/login')
def login(data: dict):
    phone = check_phone(data.get('phone'))
    pin = str(data.get('pin', ''))
    with db() as con:
        player = player_by_phone(con, phone)
        if not player or not secrets.compare_digest(hash_pin(pin, player['pin_salt']), player['pin_hash']):
            error(401, 'Numéro ou code PIN incorrect.')
        if player['banned']:
            error(403, 'Ce compte est banni du serveur RP.')
        token = secrets.token_urlsafe(40)
        con.execute('INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)',
                    (hashlib.sha256(token.encode()).hexdigest(), player['id'], (datetime.now(TZ) + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')))
        return {'token': token, 'user': public_user(player)}


@app.post('/api/logout')
def logout(request: Request):
    token = auth_token(request)
    with db() as con:
        con.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
    return {'ok': True}


@app.get('/api/me')
def me(request: Request):
    p = current(request)
    with db() as con:
        cfg = con.execute('SELECT * FROM settings WHERE player_id=?', (p['id'],)).fetchone()
    return {'user': public_user(p), 'settings': dict(cfg), 'moderator': bool(p['mod_until'] and p['mod_until'] > now())}


@app.get('/api/lookup/{phone}')
def lookup(phone: str, request: Request):
    current(request)
    with db() as con:
        row = player_by_phone(con, phone)
        if not row or row['banned']:
            error(404, 'Numéro introuvable.')
        return short_user(row)


@app.get('/api/contacts')
def get_contacts(request: Request):
    p = current(request)
    with db() as con:
        return [dict(r) for r in con.execute('SELECT id,phone,label FROM contacts WHERE owner_id=? ORDER BY label COLLATE NOCASE', (p['id'],)).fetchall()]


@app.post('/api/contacts')
def save_contact(data: dict, request: Request):
    p = current(request)
    phone = check_phone(data.get('phone'))
    label = safe_text(data.get('label'), 50)
    if not label:
        error(400, 'Indique un nom de contact.')
    with db() as con:
        target = player_by_phone(con, phone)
        if not target or target['banned']:
            error(404, 'Ce numéro n’existe pas.')
        if target['id'] == p['id']:
            error(400, 'Tu ne peux pas t’ajouter toi-même.')
        con.execute('''INSERT INTO contacts(owner_id,phone,label) VALUES(?,?,?)
            ON CONFLICT(owner_id,phone) DO UPDATE SET label=excluded.label''', (p['id'], phone, label))
    return {'ok': True}


@app.delete('/api/contacts/{contact_id}')
def delete_contact(contact_id: int, request: Request):
    p = current(request)
    with db() as con:
        con.execute('DELETE FROM contacts WHERE id=? AND owner_id=?', (contact_id, p['id']))
    return {'ok': True}


@app.get('/api/conversations')
def conversations(request: Request):
    p = current(request)
    with db() as con:
        rows = con.execute('''
          SELECT x.*, pl.phone, pl.rp_name,
           (SELECT COUNT(*) FROM messages unread WHERE unread.receiver_id=? AND unread.sender_id=x.other_id AND unread.read_at IS NULL) unread
          FROM (SELECT CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END other_id,
                 MAX(id) last_id FROM messages WHERE sender_id=? OR receiver_id=? GROUP BY other_id) x
          JOIN players pl ON pl.id=x.other_id ORDER BY x.last_id DESC''',
          (p['id'], p['id'], p['id'], p['id'])).fetchall()
        result = []
        for r in rows:
            msg = con.execute('SELECT body, created_at, sender_id FROM messages WHERE id=?', (r['last_id'],)).fetchone()
            result.append({'phone': r['phone'], 'rp_name': r['rp_name'], 'unread': r['unread'],
                           'last_text': msg['body'], 'last_time': msg['created_at'], 'mine': msg['sender_id'] == p['id']})
        return result


@app.get('/api/messages/{phone}')
def message_thread(phone: str, request: Request):
    p = current(request)
    with db() as con:
        other = player_by_phone(con, phone)
        if not other:
            error(404, 'Numéro introuvable.')
        con.execute('UPDATE messages SET read_at=? WHERE sender_id=? AND receiver_id=? AND read_at IS NULL',
                    (now(), other['id'], p['id']))
        rows = con.execute('''SELECT id,sender_id,receiver_id,body,created_at,read_at FROM messages
           WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY id DESC LIMIT 250''',
           (p['id'], other['id'], other['id'], p['id'])).fetchall()
    return {'person': short_user(other), 'messages': [dict(r) for r in reversed(rows)]}


@app.post('/api/messages')
async def send_message(data: dict, request: Request):
    p = current(request)
    phone = check_phone(data.get('phone'))
    body = safe_text(data.get('body'), 1200)
    if not body:
        error(400, 'Le message est vide.')
    with db() as con:
        target = player_by_phone(con, phone)
        if not target or target['banned']:
            error(404, 'Destinataire indisponible.')
        if target['id'] == p['id']:
            error(400, 'Tu ne peux pas t’envoyer un message.')
        cur = con.execute('INSERT INTO messages(sender_id,receiver_id,body) VALUES(?,?,?)', (p['id'], target['id'], body))
        message_id = cur.lastrowid
    event = {'type': 'message:new', 'from': p['phone'], 'from_name': p['rp_name'],
             'to': target['phone'], 'body': body, 'id': message_id}
    await live.send(target['id'], event)
    await live.send(p['id'], event)
    return {'ok': True, 'id': message_id}


@app.get('/api/calls')
def call_history(request: Request):
    p = current(request)
    with db() as con:
        rows = con.execute('''SELECT c.*, a.phone caller_phone,a.rp_name caller_name,
          b.phone callee_phone,b.rp_name callee_name FROM calls c
          JOIN players a ON a.id=c.caller_id JOIN players b ON b.id=c.callee_id
          WHERE caller_id=? OR callee_id=? ORDER BY c.id DESC LIMIT 80''', (p['id'], p['id'])).fetchall()
        return [dict(r) for r in rows]


@app.post('/api/calls')
async def initiate_call(data: dict, request: Request):
    p = current(request)
    phone = check_phone(data.get('phone'))
    with db() as con:
        other = player_by_phone(con, phone)
        if not other or other['banned']:
            error(404, 'Numéro indisponible.')
        if other['id'] == p['id']:
            error(400, 'Tu ne peux pas t’appeler toi-même.')
        online = bool(live.people.get(other['id']))
        cur = con.execute('INSERT INTO calls(caller_id,callee_id,status) VALUES(?,?,?)',
                          (p['id'], other['id'], 'ringing' if online else 'missed'))
        call_id = cur.lastrowid
        if not online:
            con.execute('UPDATE calls SET ended_at=? WHERE id=?', (now(), call_id))
    if not online:
        return {'call_id': call_id, 'online': False, 'phone': other['phone'], 'rp_name': other['rp_name']}
    await live.send(other['id'], {'type': 'call:incoming', 'call_id': call_id, 'from': p['phone'], 'from_name': p['rp_name']})
    return {'call_id': call_id, 'online': True, 'phone': other['phone'], 'rp_name': other['rp_name']}


@app.post('/api/calls/{call_id}/{action}')
async def call_action(call_id: int, action: str, request: Request):
    p = current(request)
    if action not in ('accept', 'reject', 'end'):
        error(400, 'Action inconnue.')
    with db() as con:
        call = con.execute('SELECT * FROM calls WHERE id=?', (call_id,)).fetchone()
        if not call or p['id'] not in (call['caller_id'], call['callee_id']):
            error(404, 'Appel introuvable.')
        if action == 'accept':
            if call['status'] != 'ringing' or p['id'] != call['callee_id']:
                error(409, 'Cet appel ne peut pas être accepté.')
            con.execute('UPDATE calls SET status=?,answered_at=? WHERE id=?', ('active', now(), call_id))
            status = 'accepted'
        elif action == 'reject':
            if call['status'] != 'ringing' or p['id'] != call['callee_id']:
                error(409, 'Cet appel ne peut pas être refusé.')
            con.execute('UPDATE calls SET status=?,ended_at=? WHERE id=?', ('rejected', now(), call_id))
            status = 'rejected'
        else:
            if call['status'] not in ('ringing', 'active'):
                return {'ok': True}
            final = 'missed' if call['status'] == 'ringing' else 'ended'
            con.execute('UPDATE calls SET status=?,ended_at=? WHERE id=?', (final, now(), call_id))
            status = 'ended'
    event = {'type': 'call:' + status, 'call_id': call_id}
    await live.send(call['caller_id'], event)
    await live.send(call['callee_id'], event)
    return {'ok': True}


@app.get('/api/bank')
def bank(request: Request):
    p = current(request)
    with db() as con:
        txs = con.execute('''SELECT t.*,a.phone sender_phone,a.rp_name sender_name,
          b.phone receiver_phone,b.rp_name receiver_name FROM bank_transactions t
          LEFT JOIN players a ON a.id=t.from_id LEFT JOIN players b ON b.id=t.to_id
          WHERE t.from_id=? OR t.to_id=? ORDER BY t.id DESC LIMIT 50''', (p['id'], p['id'])).fetchall()
    return {'balance': p['balance'], 'transactions': [dict(t) for t in txs]}


@app.post('/api/bank/transfer')
async def transfer(data: dict, request: Request):
    p = current(request)
    try:
        amount = int(data.get('amount'))
    except (ValueError, TypeError):
        error(400, 'Montant incorrect.')
    if amount < 1 or amount > 10000000:
        error(400, 'Montant entre 1 $ et 10 000 000 $.')
    phone = check_phone(data.get('phone'))
    memo = safe_text(data.get('memo'), 100) or 'Virement Maze Bank'
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        actor = con.execute('SELECT * FROM players WHERE id=?', (p['id'],)).fetchone()
        other = player_by_phone(con, phone)
        if not other or other['banned'] or other['id'] == actor['id']:
            error(400, 'Destinataire incorrect.')
        if actor['balance'] < amount:
            error(400, 'Solde insuffisant.')
        con.execute('UPDATE players SET balance=balance-? WHERE id=?', (amount, actor['id']))
        con.execute('UPDATE players SET balance=balance+? WHERE id=?', (amount, other['id']))
        con.execute('INSERT INTO bank_transactions(from_id,to_id,amount,memo) VALUES(?,?,?,?)',
                    (actor['id'], other['id'], amount, memo))
    await live.send(other['id'], {'type': 'bank:received', 'from': p['rp_name'], 'amount': amount})
    await live.send(p['id'], {'type': 'data:changed'})
    return {'ok': True}


JOBS = [
    {'name': 'Chauffeur de taxi', 'salary': 450},
    {'name': 'Mécanicien', 'salary': 580},
    {'name': 'Livreur', 'salary': 380},
    {'name': 'Policier LSPD', 'salary': 850},
    {'name': 'Ambulancier', 'salary': 720},
    {'name': 'Agent de sécurité', 'salary': 520},
    {'name': 'Commerçant', 'salary': 490},
]


@app.get('/api/jobs')
def jobs(request: Request):
    p = current(request)
    with db() as con:
        reqs = con.execute('SELECT * FROM job_requests WHERE player_id=? ORDER BY id DESC LIMIT 10', (p['id'],)).fetchall()
    return {'jobs': JOBS, 'current': p['job'], 'requests': [dict(r) for r in reqs]}


@app.post('/api/jobs')
async def apply_job(data: dict, request: Request):
    p = current(request)
    job = safe_text(data.get('job'), 100)
    if job not in [j['name'] for j in JOBS]:
        error(400, 'Ce métier n’existe pas.')
    with db() as con:
        existing = con.execute('SELECT id FROM job_requests WHERE player_id=? AND status=?', (p['id'], 'pending')).fetchone()
        if existing:
            error(409, 'Tu as déjà une candidature en attente.')
        con.execute('INSERT INTO job_requests(player_id,job) VALUES(?,?)', (p['id'], job))
    await live.mods({'type': 'mod:changed'})
    return {'ok': True}


@app.get('/api/store')
def store(request: Request):
    p = current(request)
    with db() as con:
        apps = con.execute('SELECT * FROM custom_apps ORDER BY id DESC').fetchall()
        reqs = con.execute('SELECT * FROM app_requests WHERE player_id=? ORDER BY id DESC LIMIT 30', (p['id'],)).fetchall()
    return {'apps': [dict(a) for a in apps], 'requests': [dict(r) for r in reqs]}


@app.post('/api/store/requests')
async def request_app(data: dict, request: Request):
    p = current(request)
    name = safe_text(data.get('name'), 45)
    description = safe_text(data.get('description'), 500)
    if len(name) < 2 or len(description) < 8:
        error(400, 'Précise le nom et la description de l’application.')
    with db() as con:
        con.execute('INSERT INTO app_requests(player_id,name,description) VALUES(?,?,?)', (p['id'], name, description))
    await live.mods({'type': 'mod:changed'})
    return {'ok': True}


@app.get('/api/photos')
def photos(request: Request):
    p = current(request)
    with db() as con:
        return [dict(r) for r in con.execute('SELECT id,created_at FROM photos WHERE owner_id=? ORDER BY id DESC', (p['id'],)).fetchall()]


@app.post('/api/photos')
async def add_photo(request: Request):
    p = current(request)
    blob = await request.body()
    if len(blob) > 6 * 1024 * 1024:
        error(413, 'Photo trop volumineuse (maximum 6 Mo).')
    try:
        im = Image.open(io.BytesIO(blob))
        if im.width * im.height > 20_000_000 or im.width < 5 or im.height < 5:
            error(400, 'Dimensions de photo non acceptées.')
        im = im.convert('RGB')
        im.thumbnail((2200, 2200))
        buffer = io.BytesIO()
        im.save(buffer, 'JPEG', quality=88, optimize=True)
    except (UnidentifiedImageError, ValueError, OSError):
        error(400, 'Image invalide (JPG, PNG, WEBP).')
    filename = secrets.token_hex(20) + '.jpg'
    (UPLOADS / filename).write_bytes(buffer.getvalue())
    with db() as con:
        cur = con.execute('INSERT INTO photos(owner_id,filename) VALUES(?,?)', (p['id'], filename))
    return {'ok': True, 'id': cur.lastrowid}


@app.get('/api/photos/{photo_id}/file')
def photo_file(photo_id: int, request: Request):
    p = current(request)
    with db() as con:
        photo = con.execute('SELECT filename FROM photos WHERE id=? AND owner_id=?', (photo_id, p['id'])).fetchone()
    if not photo:
        error(404, 'Photo introuvable.')
    return FileResponse(UPLOADS / photo['filename'], media_type='image/jpeg')


@app.delete('/api/photos/{photo_id}')
def photo_delete(photo_id: int, request: Request):
    p = current(request)
    with db() as con:
        photo = con.execute('SELECT filename FROM photos WHERE id=? AND owner_id=?', (photo_id, p['id'])).fetchone()
        if not photo:
            error(404, 'Photo introuvable.')
        con.execute('DELETE FROM photos WHERE id=?', (photo_id,))
    (UPLOADS / photo['filename']).unlink(missing_ok=True)
    return {'ok': True}


@app.post('/api/settings')
def save_settings(data: dict, request: Request):
    p = current(request)
    ringtone = safe_text(data.get('ringtone'), 20)
    wallpaper = safe_text(data.get('wallpaper'), 20)
    if ringtone not in ('Neon', 'Classique', 'Pulse', 'Calme') or wallpaper not in ('violet', 'sunset', 'ocean', 'midnight'):
        error(400, 'Réglage non reconnu.')
    notifications = int(bool(data.get('notifications')))
    sounds = int(bool(data.get('sounds')))
    with db() as con:
        con.execute('''UPDATE settings SET ringtone=?,notifications=?,sounds=?,wallpaper=? WHERE player_id=?''',
                    (ringtone, notifications, sounds, wallpaper, p['id']))
    return {'ok': True}


@app.post('/api/mod/unlock')
def unlock_mod(data: dict, request: Request):
    p = current(request)
    if not secrets.compare_digest(str(data.get('code', '')), MOD_CODE):
        error(403, 'Code modérateur incorrect.')
    token = auth_token(request)
    mod_until = (datetime.now(TZ) + timedelta(hours=12)).strftime('%Y-%m-%d %H:%M:%S')
    with db() as con:
        con.execute('UPDATE sessions SET mod_until=? WHERE token_hash=?',
                    (mod_until, hashlib.sha256(token.encode()).hexdigest()))
        audit(con, p['id'], None, 'unlock', 'Accès modérateur activé')
    return {'ok': True}


@app.get('/api/mod/players')
def mod_players(request: Request):
    current(request, True)
    with db() as con:
        return [public_user(p) for p in con.execute('SELECT * FROM players ORDER BY id DESC LIMIT 500').fetchall()]


@app.post('/api/mod/players/{player_id}/ban')
async def mod_ban(player_id: int, data: dict, request: Request):
    admin = current(request, True)
    ban = bool(data.get('banned', True))
    if player_id == admin['id'] and ban:
        error(400, 'Tu ne peux pas te bannir toi-même.')
    with db() as con:
        row = con.execute('SELECT * FROM players WHERE id=?', (player_id,)).fetchone()
        if not row:
            error(404, 'Joueur inconnu.')
        con.execute('UPDATE players SET banned=? WHERE id=?', (int(ban), player_id))
        if ban:
            con.execute('DELETE FROM sessions WHERE player_id=?', (player_id,))
        audit(con, admin['id'], player_id, 'ban' if ban else 'unban', safe_text(data.get('reason'), 150))
    if ban:
        await live.send(player_id, {'type': 'account:banned'})
        for sock in list(live.people.get(player_id, [])):
            try: await sock.close(code=4003)
            except Exception: pass
    await live.mods({'type': 'mod:changed'})
    return {'ok': True}


@app.post('/api/mod/players/{player_id}/money')
async def mod_money(player_id: int, data: dict, request: Request):
    admin = current(request, True)
    try:
        amount = int(data.get('amount'))
    except (ValueError, TypeError):
        error(400, 'Montant incorrect.')
    if amount == 0 or abs(amount) > 10_000_000:
        error(400, 'Montant entre -10 000 000 et +10 000 000, hors zéro.')
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        player = con.execute('SELECT * FROM players WHERE id=?', (player_id,)).fetchone()
        if not player:
            error(404, 'Joueur introuvable.')
        if player['balance'] + amount < 0:
            error(400, 'Le solde ne peut pas être négatif.')
        con.execute('UPDATE players SET balance=balance+? WHERE id=?', (amount, player_id))
        con.execute('INSERT INTO bank_transactions(from_id,to_id,amount,memo) VALUES(?,?,?,?)',
                    (None if amount > 0 else player_id, player_id if amount > 0 else None, abs(amount),
                     'Ajustement modération : ' + ('crédit' if amount > 0 else 'débit')))
        audit(con, admin['id'], player_id, 'money', str(amount))
    await live.send(player_id, {'type': 'bank:adjusted', 'amount': amount})
    await live.mods({'type': 'mod:changed'})
    return {'ok': True}


@app.get('/api/mod/messages')
def mod_messages(request: Request, search: str = ''):
    current(request, True)
    with db() as con:
        rows = con.execute('''SELECT m.id, m.body, m.created_at, a.phone sender_phone,
          a.rp_name sender_name,b.phone receiver_phone,b.rp_name receiver_name
          FROM messages m JOIN players a ON a.id=m.sender_id JOIN players b ON b.id=m.receiver_id
          WHERE ?='' OR a.phone LIKE ? OR b.phone LIKE ? OR a.rp_name LIKE ? OR b.rp_name LIKE ?
          ORDER BY m.id DESC LIMIT 250''',
          (search, f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
        return [dict(r) for r in rows]


@app.get('/api/mod/calls')
def mod_calls(request: Request):
    current(request, True)
    with db() as con:
        rows = con.execute('''SELECT c.*, a.phone caller_phone,a.rp_name caller_name,
          b.phone callee_phone,b.rp_name callee_name FROM calls c
          JOIN players a ON a.id=c.caller_id JOIN players b ON b.id=c.callee_id
          ORDER BY c.id DESC LIMIT 200''').fetchall()
        return [dict(r) for r in rows]


@app.get('/api/mod/requests')
def mod_requests(request: Request):
    current(request, True)
    with db() as con:
        jobs = con.execute('''SELECT j.*,p.rp_name,p.phone FROM job_requests j JOIN players p ON p.id=j.player_id
          ORDER BY CASE WHEN j.status='pending' THEN 0 ELSE 1 END, j.id DESC LIMIT 100''').fetchall()
        apps = con.execute('''SELECT a.*,p.rp_name,p.phone FROM app_requests a JOIN players p ON p.id=a.player_id
          ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END, a.id DESC LIMIT 100''').fetchall()
        actions = con.execute('''SELECT l.*,p.rp_name actor_name FROM admin_actions l JOIN players p ON p.id=l.actor_id
          ORDER BY l.id DESC LIMIT 40''').fetchall()
        return {'jobs': [dict(r) for r in jobs], 'apps': [dict(r) for r in apps], 'actions': [dict(r) for r in actions]}


@app.post('/api/mod/jobs/{request_id}/{decision}')
async def decide_job(request_id: int, decision: str, request: Request):
    admin = current(request, True)
    if decision not in ('approved', 'rejected'):
        error(400, 'Décision inconnue.')
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        req = con.execute('SELECT * FROM job_requests WHERE id=?', (request_id,)).fetchone()
        if not req or req['status'] != 'pending':
            error(409, 'Cette candidature est déjà traitée.')
        con.execute('UPDATE job_requests SET status=?, reviewed_at=? WHERE id=?', (decision, now(), request_id))
        if decision == 'approved':
            con.execute('UPDATE players SET job=? WHERE id=?', (req['job'], req['player_id']))
        audit(con, admin['id'], req['player_id'], 'job_' + decision, req['job'])
    await live.send(req['player_id'], {'type': 'job:decision', 'decision': decision, 'job': req['job']})
    await live.mods({'type': 'mod:changed'})
    return {'ok': True}


@app.post('/api/mod/apps/{request_id}/{decision}')
async def decide_app(request_id: int, decision: str, request: Request):
    admin = current(request, True)
    if decision not in ('approved', 'rejected'):
        error(400, 'Décision inconnue.')
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        req = con.execute('SELECT * FROM app_requests WHERE id=?', (request_id,)).fetchone()
        if not req or req['status'] != 'pending':
            error(409, 'Demande déjà traitée.')
        con.execute('UPDATE app_requests SET status=?,reviewed_at=? WHERE id=?', (decision, now(), request_id))
        if decision == 'approved':
            con.execute('INSERT INTO custom_apps(name,description) VALUES(?,?)', (req['name'], req['description']))
        audit(con, admin['id'], req['player_id'], 'app_' + decision, req['name'])
    await live.send(req['player_id'], {'type': 'app:decision', 'decision': decision, 'name': req['name']})
    for uid in list(live.people):
        await live.send(uid, {'type': 'store:changed'})
    await live.mods({'type': 'mod:changed'})
    return {'ok': True}


@app.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
    token = ws.query_params.get('token', '')
    try:
        p = session_for(token)
    except HTTPException:
        await ws.close(code=4001)
        return
    await ws.accept()
    uid = p['id']
    live.people[uid].add(ws)
    await live.send(uid, {'type': 'presence:online'})
    try:
        while True:
            packet = await ws.receive_json()
            if packet.get('type') != 'rtc:signal':
                continue
            kind = packet.get('signal_type')
            call_id = packet.get('call_id')
            if kind not in ('offer', 'answer', 'ice') or not isinstance(call_id, int):
                continue
            with db() as con:
                call = con.execute('SELECT * FROM calls WHERE id=?', (call_id,)).fetchone()
            if not call or call['status'] != 'active' or uid not in (call['caller_id'], call['callee_id']):
                continue
            other = call['callee_id'] if uid == call['caller_id'] else call['caller_id']
            await live.send(other, {'type': 'rtc:signal', 'call_id': call_id, 'signal_type': kind, 'data': packet.get('data')})
    except (WebSocketDisconnect, RuntimeError, ValueError):
        pass
    finally:
        live.people[uid].discard(ws)
        if not live.people[uid]:
            live.people.pop(uid, None)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '8000')))
