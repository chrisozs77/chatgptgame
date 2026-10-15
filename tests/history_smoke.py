"""Verify sign-in gating, recent-ten preview, full filters, and persistent offline edits."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect
from browser_helpers import ACCOUNT_KEY, PROJECT, signed_in_offline

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

records = []
for year, month, count in [(2024,3,3),(2025,3,4),(2025,4,4),(2026,10,3)]:
    for day in range(1, count+1):
        label = f'Session {year}-{month:02d}-{day:02d}'
        records.append({'id':label,'result':'gain','cents':1000,'note':label,
            'createdAt':f'{year}-{month:02d}-{day:02d}T20:00:00.000Z','deleted':False,'revision':''})
root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        gate = browser.new_context()
        gate.route(PROJECT+'/**',lambda route: route.abort())
        locked = gate.new_page(); locked.goto(origin)
        expect(locked.get_by_text('SIGN IN REQUIRED',exact=True)).to_be_visible()
        expect(locked.get_by_role('tab')).to_have_count(0)
        expect(locked.get_by_role('textbox',name='Amount in US dollars')).to_have_count(0)
        locked.get_by_role('button',name='SIGN IN / CREATE ACCOUNT',exact=True).click()
        locked.get_by_role('button',name='CANCEL',exact=True).click()
        expect(locked.get_by_text('SIGN IN REQUIRED',exact=True)).to_be_visible()
        gate.close()
        context = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,timezone_id='America/Los_Angeles')
        signed_in_offline(context,records)
        page = context.new_page(); errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(origin)
        recent = page.get_by_test_id('recent-entries')
        expect(recent.get_by_role('button',name='Edit',exact=False)).to_have_count(10)
        expect(recent.get_by_text('Session 2024-03-01',exact=True)).to_have_count(0)
        expect(page.get_by_label('Net profit $140.00',exact=True)).to_have_text('+$140.00')
        page.get_by_role('button',name='VIEW FULL HISTORY',exact=True).click()
        full = page.get_by_test_id('full-history')
        expect(full.get_by_text('14 transactions',exact=True)).to_be_visible()
        expect(full.get_by_role('button',name='Edit',exact=False)).to_have_count(14)
        page.get_by_role('button',name='Month filter',exact=True).click()
        page.get_by_role('radio',name='March',exact=True).click()
        expect(full.get_by_text('7 transactions',exact=True)).to_be_visible()
        page.get_by_role('button',name='Year filter',exact=True).click()
        page.get_by_role('radio',name='2024',exact=True).click()
        expect(full.get_by_text('3 transactions',exact=True)).to_be_visible()
        page.get_by_role('button',name='Month filter',exact=True).click()
        page.get_by_role('radio',name='April',exact=True).click()
        expect(full.get_by_text('NO TRANSACTIONS',exact=True)).to_be_visible()
        page.get_by_role('tab',name='Tracker',exact=True).click()
        page.get_by_role('button',name='VIEW FULL HISTORY',exact=True).click()
        expect(full.get_by_text('14 transactions',exact=True)).to_be_visible()
        page.get_by_role('button',name='Year filter',exact=True).click()
        page.get_by_role('radio',name='2026',exact=True).click()
        page.get_by_role('button',name='Month filter',exact=True).click()
        page.get_by_role('radio',name='October',exact=True).click()
        expect(full.get_by_text('3 transactions',exact=True)).to_be_visible()
        full.get_by_role('button',name='Edit Session 2026-10-03 $10.00',exact=True).click()
        page.get_by_role('textbox',name='Edited amount in US dollars').fill('0')
        page.get_by_role('button',name='SAVE CHANGES',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Enter an amount')
        page.get_by_role('button',name='CANCEL EDIT',exact=True).click()
        full.get_by_role('button',name='Edit Session 2026-10-03 $10.00',exact=True).click()
        page.get_by_role('textbox',name='Edited amount in US dollars').fill('15.50')
        page.get_by_role('button',name='Edit result: loss',exact=True).click()
        page.get_by_role('textbox',name='Edited session note').fill('Corrected session')
        page.get_by_role('button',name='SAVE CHANGES',exact=True).click()
        expect(full.get_by_text('Corrected session',exact=True)).to_be_visible()
        expect(page.get_by_label('History net profit $4.50',exact=True)).to_have_text('+$4.50')
        # Editing preserves identity, date, and the transaction count.
        saved = json.loads(page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')"))
        corrected = next(row for row in saved['records'] if row['note']=='Corrected session')
        assert corrected['id']=='Session 2026-10-03' and corrected['createdAt']=='2026-10-03T20:00:00.000Z'
        assert len(saved['records'])==14 and corrected['revision']
        for width,height in [(320,844),(390,500),(430,844),(1200,900)]:
            page.set_viewport_size({'width':width,'height':height})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'Overflow at {width}px'
            box=page.get_by_role('tab',name='History',exact=True).bounding_box()
            assert abs(box['y']+box['height']-height)<1
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path='/tmp/degen-history-filtered.png')
        page.get_by_role('tab',name='Tracker',exact=True).click()
        expect(page.get_by_label('Net profit $114.50',exact=True)).to_have_text('+$114.50')
        page.get_by_role('button',name='VIEW FULL HISTORY',exact=True).click()
        full.get_by_role('button',name='Delete Corrected session $15.50',exact=True).click()
        page.get_by_role('button',name='KEEP IT',exact=True).click()
        expect(full.get_by_text('14 transactions',exact=True)).to_be_visible()
        full.get_by_role('button',name='Delete Corrected session $15.50',exact=True).click()
        page.get_by_role('button',name='Confirm removal',exact=True).click()
        expect(full.get_by_text('13 transactions',exact=True)).to_be_visible()
        expect(page.get_by_label('History net profit $130.00',exact=True)).to_have_text('+$130.00')
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        context.set_offline(True); page.reload()
        expect(page.get_by_label('Net profit $130.00',exact=True)).to_have_text('+$130.00')
        page.get_by_role('tab',name='History',exact=True).click()
        expect(full.get_by_text('13 transactions',exact=True)).to_be_visible()
        assert not errors,errors
        browser.close()
        print('PASS: mandatory sign-in, no guest bypass, recent ten, all/month/year filters, filtered totals, edit validation/cancel/save, original date/ID, deletion confirmation, mobile/desktop toolbar, and offline persistence')
finally:
    server.shutdown(); server.server_close()
