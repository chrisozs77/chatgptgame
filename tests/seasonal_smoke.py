"""Exercise seasonal calendar changes and a local preference without altering logs."""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect
from browser_helpers import ACCOUNT_KEY, PROJECT, signed_in_offline

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root/'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
def clock(page, date):
    page.clock.install(time=datetime.fromisoformat(date).replace(tzinfo=timezone.utc))

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox'])
        # A fresh user sees the same seasonal brand without bypassing sign-in.
        gate = browser.new_context(viewport={'width':320,'height':844}, timezone_id='America/Los_Angeles')
        gate.route(PROJECT+'/**', lambda route: route.abort())
        page = gate.new_page(); clock(page,'2026-10-31T20:00:00'); page.goto(origin)
        expect(page.get_by_text('HALLOWEEN EDITION',exact=True)).to_be_visible()
        expect(page.get_by_test_id('seasonal-hat')).to_be_visible()
        expect(page.get_by_text('SIGN IN REQUIRED',exact=True)).to_be_visible()
        expect(page.get_by_role('tab')).to_have_count(0)
        toggle=page.get_by_role('switch',name='Seasonal decorations',exact=True)
        expect(toggle).to_have_attribute('aria-checked','true')
        toggle.click(); expect(toggle).to_have_attribute('aria-checked','false')
        expect(page.get_by_test_id('seasonal-hat')).to_have_count(0)
        page.reload(); expect(toggle).to_have_attribute('aria-checked','false')
        toggle.click(); expect(page.get_by_text('HALLOWEEN EDITION',exact=True)).to_be_visible()
        gate.close()
        # Check every theme at phone and desktop widths with a remembered offline account.
        for date,name in [('2026-10-01T20:00:00','HALLOWEEN'),('2026-12-25T20:00:00','CHRISTMAS'),
                          ('2026-12-01T20:00:00','CHRISTMAS'),('2026-04-01T20:00:00','EASTER'),
                          ('2026-11-01T20:00:00','THANKSGIVING')]:
            context=browser.new_context(timezone_id='America/Los_Angeles', viewport={'width':390,'height':844})
            signed_in_offline(context)
            page=context.new_page(); clock(page,date); errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(origin)
            expect(page.get_by_text(name+' EDITION',exact=True)).to_be_visible()
            expect(page.get_by_test_id('seasonal-corner')).to_be_visible()
            for width in [320,390,1200]:
                page.set_viewport_size({'width':width,'height':844})
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'{name}: overflow at {width}px'
                box=page.get_by_role('tab',name='History',exact=True).bounding_box()
                assert abs(box['y']+box['height']-844)<1
            if name=='HALLOWEEN':
                page.get_by_role('textbox',name='Amount in US dollars').fill('12.50')
                page.get_by_role('textbox',name='Session note').fill('Seasonal regression')
                page.get_by_role('button',name='Log gain',exact=True).click()
                expect(page.get_by_label('Net profit $12.50',exact=True)).to_have_text('+$12.50')
                saved=page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')")
                toggle=page.get_by_role('switch',name='Seasonal decorations',exact=True)
                toggle.click(); expect(toggle).to_have_attribute('aria-checked','false')
                assert page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')")==saved
                page.reload(); expect(toggle).to_have_attribute('aria-checked','false')
                expect(page.get_by_label('Net profit $12.50',exact=True)).to_have_text('+$12.50')
                toggle.click()
                page.set_viewport_size({'width':390,'height':844})
                page.get_by_text('PERSONAL SCOREBOARD',exact=True).scroll_into_view_if_needed()
                page.screenshot(path='/tmp/degen-halloween.png')
                lights=page.get_by_test_id('seasonal-lights')
                before=lights.evaluate('element => getComputedStyle(element).opacity')
                page.wait_for_function("previous => getComputedStyle(document.querySelector('[data-testid=seasonal-lights]')).opacity !== previous",arg=before)
                page.emulate_media(reduced_motion='reduce')
                expect(lights).to_have_css('opacity','0.8')
                page.wait_for_timeout(300)
                expect(lights).to_have_css('opacity','0.8')
                page.emulate_media(reduced_motion='no-preference')
                page.wait_for_function('navigator.serviceWorker.controller !== null')
                context.set_offline(True)
                # Offline reload keeps the bundled artwork and the local preference.
                page.reload(); expect(page.get_by_text('HALLOWEEN EDITION',exact=True)).to_be_visible()
                assert page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')")==saved
                page.get_by_role('tab',name='Support',exact=True).click()
                expect(page.get_by_text('FREE GUIDED BOT · WORKS OFFLINE',exact=True)).to_be_visible()
            assert not errors,errors
            context.close()
        # Local midnight changes an already-open app; no reload or redeploy is required.
        context=browser.new_context(timezone_id='America/Los_Angeles')
        signed_in_offline(context); page=context.new_page()
        clock(page,'2027-01-01T07:59:55'); page.goto(origin)  # Dec 31, 23:59:55 PST
        expect(page.get_by_text('CHRISTMAS EDITION',exact=True)).to_be_visible()
        page.clock.fast_forward(6000)
        expect(page.get_by_text('CHRISTMAS EDITION',exact=True)).to_have_count(0)
        expect(page.get_by_test_id('seasonal-corner')).to_have_count(0)
        page.clock.set_system_time(datetime(2026,11,1,6,59,55,tzinfo=timezone.utc))
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(page.get_by_text('HALLOWEEN EDITION',exact=True)).to_be_visible()
        page.clock.fast_forward(6000)
        expect(page.get_by_text('THANKSGIVING EDITION',exact=True)).to_be_visible()
        # Returning after suspension or a device clock change also refreshes the theme.
        page.clock.set_system_time(datetime(2027,3,28,20,tzinfo=timezone.utc))
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(page.get_by_text('EASTER EDITION',exact=True)).to_be_visible()
        context.close(); browser.close()
        print('PASS: full-month themes, sign-in gate, saved AUTO/OFF, responsive layouts, unchanged logs, offline artwork, gentle flicker/Reduce Motion, month rollover and foreground refresh.')
finally:
    server.shutdown(); server.server_close()
