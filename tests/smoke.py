"""Exercise the exported React Native web UI. Requires Python Playwright and Chromium.

Run after `npm run export`: python tests/smoke.py
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
url = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        executable = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium')
        browser = p.chromium.launch(executable_path=executable, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.get_by_text('A FRESH SCOREBOARD', exact=True)).to_be_visible()
        page.get_by_role('button', name='Log gain', exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Enter an amount')
        page.get_by_role('textbox', name='Amount in US dollars').fill('100.50')
        page.get_by_role('textbox', name='Session note').fill('Friday poker')
        page.get_by_role('button', name='Log gain', exact=True).click()
        expect(page.get_by_text('Friday poker', exact=True)).to_be_visible()
        page.get_by_role('button', name='Select loss').click()
        page.get_by_role('textbox', name='Amount in US dollars').fill('40.25')
        page.get_by_role('textbox', name='Session note').fill('Slots')
        page.get_by_role('button', name='Log loss', exact=True).click()
        expect(page.get_by_label('Net profit $60.25', exact=True)).to_have_text('+$60.25')
        page.get_by_role('button', name='Show gains', exact=True).click()
        expect(page.get_by_text('Friday poker', exact=True)).to_be_visible()
        expect(page.get_by_text('Slots', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Show losses', exact=True).click()
        expect(page.get_by_text('Slots', exact=True)).to_be_visible()
        expect(page.get_by_text('Friday poker', exact=True)).to_have_count(0)
        page.reload()
        expect(page.get_by_label('Net profit $60.25', exact=True)).to_have_text('+$60.25')
        expect(page.get_by_text('Friday poker', exact=True)).to_have_count(1)
        page.get_by_role('button', name='Delete Friday poker $100.50').click()
        page.get_by_role('button', name='KEEP IT', exact=True).click()
        expect(page.get_by_text('Friday poker', exact=True)).to_have_count(1)
        page.get_by_role('button', name='Delete Friday poker $100.50').click()
        page.get_by_role('button', name='Confirm removal').click()
        expect(page.get_by_text('Friday poker', exact=True)).to_have_count(0)
        expect(page.get_by_label('Net profit -$40.25', exact=True)).to_have_text('-$40.25')

        # Failed writes must preserve the old ledger and keep the form available.
        page.get_by_role('button', name='Select loss').click()
        page.evaluate("() => { Storage.prototype.setItem = function() { throw new Error('Simulated quota error'); }; }")
        page.get_by_role('textbox', name='Amount in US dollars').fill('10')
        page.get_by_role('button', name='Log loss', exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Could not save')
        expect(page.get_by_label('Net profit -$40.25', exact=True)).to_have_text('-$40.25')
        page.reload()
        expect(page.get_by_label('Net profit -$40.25', exact=True)).to_have_text('-$40.25')
        page.get_by_role('button', name='Select gain').click()
        page.get_by_role('textbox', name='Amount in US dollars').fill('125.75')
        page.get_by_role('textbox', name='Session note').fill('Poker night')
        page.get_by_role('button', name='Log gain', exact=True).click()
        expect(page.get_by_label('Net profit $85.50', exact=True)).to_have_text('+$85.50')
        for width in [320, 390, 430]:
            page.set_viewport_size({'width': width, 'height': 844})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}px'
        page.set_viewport_size({'width': 390, 'height': 844})
        page.get_by_text('DEGEN', exact=True).scroll_into_view_if_needed()
        page.screenshot(path='/tmp/degen-tracker-dashboard.png')
        page.get_by_text('SESSION LOG', exact=True).scroll_into_view_if_needed()
        page.screenshot(path='/tmp/degen-tracker-ledger.png')

        # An unreadable existing save cannot be overwritten by mounting the app.
        page.evaluate("localStorage.setItem('degen-tracker.ledger.v1', 'broken-save')")
        page.reload()
        expect(page.get_by_text('SAVE UNAVAILABLE', exact=True)).to_be_visible()
        assert page.evaluate("localStorage.getItem('degen-tracker.ledger.v1')") == 'broken-save'
        page.evaluate("localStorage.removeItem('degen-tracker.ledger.v1')")
        page.get_by_role('button', name='RETRY', exact=True).click()
        expect(page.get_by_text('A FRESH SCOREBOARD', exact=True)).to_have_count(1)
        assert not errors, errors
        browser.close()
        print('PASS: entry, totals, filters, reload, removal, failed writes, save recovery, and 3 phone widths; no JavaScript errors')
finally:
    server.shutdown()
    server.server_close()
