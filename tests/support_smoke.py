"""Exercise fixed navigation and the private, offline guided support chat after export."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        page = context.new_page()
        errors, posts = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: posts.append(request.url) if request.method == 'POST' else None)
        page.goto(origin)
        tracker = page.get_by_role('tab', name='Tracker', exact=True)
        support = page.get_by_role('tab', name='Support', exact=True)
        expect(tracker).to_have_attribute('aria-selected', 'true')
        toolbar_y = support.bounding_box()['y']
        page.get_by_role('textbox', name='Amount in US dollars').fill('12.50')
        page.get_by_role('textbox', name='Session note').fill('Private financial log')
        page.get_by_role('button', name='Log gain', exact=True).click()
        expect(page.get_by_label('Net profit $12.50', exact=True)).to_have_text('+$12.50')
        saved = page.evaluate("localStorage.getItem('degen-tracker.ledger.v1')")
        page.get_by_text('YOUR LOGS. YOUR SCOREBOARD.', exact=True).scroll_into_view_if_needed()
        assert abs(support.bounding_box()['y'] - toolbar_y) < 1, 'Bottom toolbar moved while scrolling'
        page.get_by_role('textbox', name='Amount in US dollars').fill('8.25')
        support.click()
        expect(support).to_have_attribute('aria-selected', 'true')
        expect(page.get_by_text('FREE GUIDED BOT · WORKS OFFLINE', exact=True)).to_be_visible()
        page.get_by_role('button', name='I’m chasing losses', exact=True).click()
        expect(page.get_by_text('Another bet cannot guarantee recovery', exact=False)).to_be_visible()
        message = page.get_by_role('textbox', name='Message to support bot', exact=True)
        message.fill('What can I do next?')
        page.get_by_role('button', name='Send support message', exact=True).click()
        expect(page.get_by_text('You don’t need to solve the whole loss tonight.', exact=False)).to_be_visible()
        tracker.click()
        expect(page.get_by_role('textbox', name='Amount in US dollars')).to_have_value('8.25')
        expect(page.get_by_label('Net profit $12.50', exact=True)).to_have_text('+$12.50')
        support.click()
        expect(page.get_by_text('What can I do next?', exact=True)).to_be_visible()
        message.fill('Work is making me stressed')
        message.press('Enter')
        expect(page.get_by_text('Relax your shoulders', exact=False)).to_be_visible()
        assert not posts, 'Support chat made an unexpected external POST'
        assert page.evaluate("localStorage.getItem('degen-tracker.ledger.v1')") == saved
        page.get_by_role('button', name='CLEAR CHAT', exact=True).click()
        expect(page.get_by_text('What can I do next?', exact=True)).to_have_count(0)
        for width, height in [(320,844),(390,844),(430,844),(390,500)]:
            page.set_viewport_size({'width':width,'height':height})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}px'
            box = support.bounding_box()
            assert abs(box['y'] + box['height'] - height) < 1, 'Toolbar is not at viewport bottom'
            composer = message.bounding_box()
            assert composer['y'] + composer['height'] <= box['y'], 'Message composer covered by toolbar'
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path='/tmp/degen-support-start.png')
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        context.set_offline(True)
        message.fill('I feel an urge to gamble')
        page.get_by_role('button', name='Send support message', exact=True).click()
        expect(page.get_by_text('Try a 10-minute pause', exact=False)).to_be_visible()
        page.reload()
        support.click()
        expect(page.get_by_text('I feel an urge to gamble', exact=True)).to_have_count(0)
        message.fill('I lost money and want to hurt myself')
        page.get_by_role('button', name='Send support message', exact=True).click()
        expect(page.get_by_role('link', name='US crisis support: 988', exact=True)).to_be_visible()
        expect(page.get_by_role('link', name='Gambling Therapy', exact=True)).to_be_visible()
        page.screenshot(path='/tmp/degen-support-help.png')
        # Even damaged tracker data must not block access to support.
        page.evaluate("localStorage.setItem('degen-tracker.ledger.v1', 'broken-save')")
        page.reload()
        expect(page.get_by_text('SAVE UNAVAILABLE', exact=True)).to_be_visible()
        support.click()
        message.fill('I feel stressed')
        page.get_by_role('button', name='Send support message', exact=True).click()
        expect(page.get_by_text('Relax your shoulders', exact=False)).to_be_visible()
        assert page.evaluate("localStorage.getItem('degen-tracker.ledger.v1')") == 'broken-save'
        assert not errors, errors
        assert not posts, posts
        browser.close()
        print('PASS: fixed tabs, preserved tracker form/logs, contextual guided chat, Enter-to-send, no chat network requests, mobile layouts, offline use, session clearing, crisis resources, and support during corrupt tracker recovery')
finally:
    server.shutdown(); server.server_close()
