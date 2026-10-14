"""Use a simulated Supabase HTTP API to test sign-in and cloud UI without sending email.

Export with the synthetic test URL/key, then run with --directory pointing to that export.
"""
import argparse
import base64
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading
import time
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--directory', default='/tmp/degen-cloud-test')
args = parser.parse_args()
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(Path(args.directory).resolve())))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
users = {'alice@example.test': '11111111-1111-4111-8111-111111111111', 'bob@example.test': '22222222-2222-4222-8222-222222222222'}
records = {}
fail = {'rest': False, 'auth': False}
errors = []
def encoded(data):
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
def session(email):
    uid = users[email]
    token = f'{encoded({"alg":"HS256","typ":"JWT"})}.{encoded({"sub":uid,"role":"authenticated","aud":"authenticated","exp":int(time.time())+3600})}.fake-signature'
    return {'access_token': token, 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600,
        'refresh_token': 'refresh-' + uid, 'user': {'id': uid, 'email': email, 'aud': 'authenticated', 'role': 'authenticated',
        'app_metadata': {'provider': 'email', 'providers': ['email']}, 'user_metadata': {}, 'created_at': '2026-10-14T18:00:00Z'}}

def intercept(route):
    request = route.request
    headers = {'content-type': 'application/json', 'access-control-allow-origin': origin,
        'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        'access-control-expose-headers': 'content-range'}
    parsed = urlsplit(request.url)
    if request.method == 'OPTIONS': route.fulfill(status=204, headers=headers); return
    body = request.post_data_json if request.post_data else {}
    if parsed.path == '/auth/v1/otp':
        assert body.get('email') in users
        route.fulfill(status=200, headers=headers, body='{}'); return
    if parsed.path == '/auth/v1/verify':
        if body.get('token') != '123456': route.fulfill(status=403, headers=headers, body=json.dumps({'error_code':'otp_expired','msg':'Invalid code'})); return
        route.fulfill(status=200, headers=headers, body=json.dumps(session(body['email']))); return
    if parsed.path == '/auth/v1/logout': route.fulfill(status=204, headers=headers); return
    if parsed.path == '/auth/v1/token':
        if fail['auth']: route.abort('internetdisconnected'); return
        email = next(email for email, uid in users.items() if body['refresh_token'] == 'refresh-' + uid)
        route.fulfill(status=200, headers=headers, body=json.dumps(session(email))); return
    if parsed.path == '/rest/v1/degen_ledger_entries':
        if fail['rest']: route.abort('internetdisconnected'); return
        token = request.headers.get('authorization', '').removeprefix('Bearer ')
        try: uid = json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '===')).get('sub')
        except Exception: uid = None
        if uid not in users.values(): route.fulfill(status=401, headers=headers, body='{}'); return
        if request.method == 'POST':
            for row in body:
                if row['user_id'] != uid: route.fulfill(status=403, headers=headers, body='{}'); return
                key = (uid, row['id'])
                records[key] = {**row, 'deleted': row['deleted'] or records.get(key, {}).get('deleted', False)}
            route.fulfill(status=201, headers=headers, body=''); return
        query = parse_qs(parsed.query)
        requested = query.get('user_id', [''])[0].removeprefix('eq.')
        rows = sorted([row for (owner, _), row in records.items() if owner == uid == requested], key=lambda r: r['id'])
        offset = int(query.get('offset', ['0'])[0]); limit = int(query.get('limit', ['1000'])[0])
        route.fulfill(status=200, headers=headers, body=json.dumps(rows[offset:offset + limit])); return
    errors.append('Unexpected synthetic API request: ' + parsed.path)
    route.fulfill(status=404, headers=headers, body='{}')

def open_device(browser):
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    context.route('https://cloud.degen.test/**', intercept)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(origin)
    expect(page.get_by_role('button', name='SIGN IN / CREATE ACCOUNT', exact=True)).to_have_count(1)
    return context, page
def sign_in(page, email, wrong_code=False):
    page.get_by_role('button', name='SIGN IN / CREATE ACCOUNT', exact=True).click()
    page.get_by_role('textbox', name='Account email').fill(email)
    page.get_by_role('button', name='EMAIL ME A CODE', exact=True).click()
    expect(page.get_by_text('CHECK YOUR EMAIL', exact=True)).to_have_count(1)
    if wrong_code:
        page.get_by_role('textbox', name='Email sign-in code').fill('000000')
        page.get_by_role('button', name='SIGN IN', exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('could not be verified')
    page.get_by_role('textbox', name='Email sign-in code').fill('123456')
    page.get_by_role('button', name='SIGN IN', exact=True).click()
    expect(page.get_by_text(email, exact=True)).to_have_count(1)
    expect(page.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
def log(page, result, amount, note):
    page.get_by_role('button', name='Select ' + result).click()
    page.get_by_role('textbox', name='Amount in US dollars').fill(amount)
    page.get_by_role('textbox', name='Session note').fill(note)
    page.get_by_role('button', name='Log ' + result, exact=True).click()
    expect(page.get_by_text(note, exact=True)).to_have_count(1)
def net(page, value):
    expect(page.get_by_label('Net profit $' + value, exact=True)).to_have_text('+$' + value)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox'])
        context, first = open_device(browser)
        log(first, 'gain', '5.00', 'Guest result')
        sign_in(first, 'alice@example.test', wrong_code=True)
        expect(first.get_by_label('Net profit $0.00', exact=True)).to_have_text('$0.00')
        expect(first.get_by_text('Guest result', exact=True)).to_have_count(0)
        assert not records, 'Guest history was uploaded without consent'
        first.get_by_role('button', name='BACK UP LOCAL LOGS', exact=True).click()
        first.get_by_role('button', name='CONFIRM BACKUP', exact=True).click()
        net(first, '5.00')
        expect(first.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        log(first, 'gain', '100.25', 'Alice cloud')
        net(first, '105.25')
        expect(first.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        second_context, second = open_device(browser)
        sign_in(second, 'alice@example.test')
        net(second, '105.25')

        first.wait_for_function('navigator.serviceWorker.controller !== null')
        fail['rest'] = True
        context.set_offline(True)
        log(first, 'loss', '20.25', 'Offline result')
        net(first, '85.00')
        expect(first.get_by_text('CLOUD SAVED', exact=True)).to_have_count(0)
        # Reopening long after login must still show the account cache offline.
        first.evaluate("""() => {
            const key = Object.keys(localStorage).find(k => k.startsWith('degen-tracker.auth.'));
            const saved = JSON.parse(localStorage.getItem(key));
            saved.expires_at = Math.floor(Date.now()/1000) - 3600;
            localStorage.setItem(key, JSON.stringify(saved));
        }""")
        fail['auth'] = True
        first.reload()
        net(first, '85.00')
        expect(first.get_by_text('alice@example.test', exact=True)).to_have_count(1)
        context.set_offline(False); fail['rest'] = False; fail['auth'] = False
        first.get_by_role('button', name='SYNC NOW', exact=True).click()
        expect(first.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        second.get_by_role('button', name='SYNC NOW', exact=True).click()
        net(second, '85.00')
        second.get_by_role('button', name='Delete Guest result $5.00', exact=True).click()
        second.get_by_role('button', name='Confirm removal', exact=True).click()
        net(second, '80.00')
        expect(second.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        first.get_by_role('button', name='SYNC NOW', exact=True).click()
        net(first, '80.00')

        bob_context, bob = open_device(browser)
        sign_in(bob, 'bob@example.test')
        expect(bob.get_by_label('Net profit $0.00', exact=True)).to_have_text('$0.00')
        expect(bob.get_by_text('Alice cloud', exact=True)).to_have_count(0)
        log(bob, 'gain', '7.00', 'Bob cloud')
        expect(bob.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        first.get_by_role('button', name='SIGN OUT', exact=True).click()
        expect(first.get_by_role('button', name='SIGN IN / CREATE ACCOUNT', exact=True)).to_have_count(1)
        net(first, '5.00')
        expect(first.get_by_text('Alice cloud', exact=True)).to_have_count(0)
        sign_in(first, 'bob@example.test')
        net(first, '7.00')
        expect(first.get_by_text('Alice cloud', exact=True)).to_have_count(0)
        assert len([row for (owner, _), row in records.items() if owner == users['bob@example.test']]) == 1
        first.get_by_role('button', name='SIGN OUT', exact=True).click()
        expect(first.get_by_role('button', name='SIGN IN / CREATE ACCOUNT', exact=True)).to_have_count(1)
        sign_in(first, 'alice@example.test')
        net(first, '80.00')

        # Lost local storage can be recovered only after signing into the same account.
        second.evaluate('localStorage.clear()')
        second.reload()
        expect(second.get_by_role('button', name='SIGN IN / CREATE ACCOUNT', exact=True)).to_have_count(1)
        sign_in(second, 'alice@example.test')
        net(second, '80.00')
        # Two tabs in one browser profile must preserve both offline queues.
        tab = context.new_page()
        tab.on('pageerror', lambda error: errors.append(str(error)))
        tab.goto(origin)
        expect(tab.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        net(tab, '80.00')
        fail['rest'] = True
        log(first, 'gain', '1.00', 'First tab')
        log(tab, 'gain', '2.00', 'Second tab')
        pending = tab.evaluate("""() => {
            const key = Object.keys(localStorage).find(k => k.startsWith('degen-tracker.account.'));
            return JSON.parse(localStorage.getItem(key)).pending.length;
        }""")
        assert pending == 2, 'One tab overwrote another tab’s offline changes'
        fail['rest'] = False
        first.get_by_role('button', name='SYNC NOW', exact=True).click()
        expect(first.get_by_text('CLOUD SAVED', exact=True)).to_have_count(1)
        tab.get_by_role('button', name='SYNC NOW', exact=True).click()
        net(tab, '83.00')
        tab.close()
        assert not errors, errors
        browser.close()
        print('PASS: email-code sign-in, failed code, explicit import, 2-device restore, expired-token offline reopen, synced deletion, account switching, local storage recovery, and simultaneous tab queues (simulated HTTP API)')
finally:
    server.shutdown(); server.server_close()
