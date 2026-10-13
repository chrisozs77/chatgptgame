"""After export: python tests/pwa.py [--directory /tmp/degen-pages --base-path /chatgptgame]."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re
import shutil
import tempfile
import threading
import time
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--directory', default='dist')
parser.add_argument('--base-path', default='')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = (root / args.directory).resolve()
base_path = args.base_path.rstrip('/')
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

with tempfile.TemporaryDirectory(prefix='degen-pwa-test-') as folder:
    host_root = Path(folder)
    app_root = host_root / base_path.lstrip('/') if base_path else host_root
    shutil.copytree(source, app_root, dirs_exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(host_root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    url = origin + base_path + '/'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, timezone_id='America/Los_Angeles')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url)
            expect(page.get_by_text('LOG A RESULT', exact=True)).to_have_count(1)
            manifest_response = context.request.get(url + 'manifest.webmanifest')
            assert manifest_response.ok
            manifest = manifest_response.json()
            assert manifest['name'] == 'Degen Tracker' and manifest['display'] == 'standalone'
            assert manifest['start_url'] == base_path + '/' and manifest['scope'] == base_path + '/'
            for icon in manifest['icons']:
                response = context.request.get(origin + icon['src'])
                assert response.ok and response.body().startswith(b'\x89PNG'), icon
            assert page.locator('link[rel="apple-touch-icon"]').get_attribute('href') == base_path + '/icons/icon-180.png'
            app_manifest = context.new_cdp_session(page).send('Page.getAppManifest')
            assert not app_manifest.get('errors'), app_manifest
            page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=15000)
            cached_paths = page.evaluate("""async () => {
                const keys = await caches.keys();
                const cache = await caches.open(keys.find(k => k.startsWith('degen-tracker:')));
                return (await cache.keys()).map(r => new URL(r.url).pathname);
            }""")
            assert any(path.endswith('.ttf') for path in cached_paths), cached_paths
            assert any(path.endswith('.js') for path in cached_paths), cached_paths
            page.get_by_role('textbox', name='Amount in US dollars').fill('25.15')
            page.get_by_role('button', name='Log gain', exact=True).click()
            expect(page.get_by_label('Net profit $25.15', exact=True)).to_have_text('+$25.15')
            context.set_offline(True)
            page.reload()
            expect(page.get_by_label('Net profit $25.15', exact=True)).to_have_text('+$25.15')
            page.get_by_role('button', name='Select loss').click()
            page.get_by_role('textbox', name='Amount in US dollars').fill('5.05')
            page.get_by_role('button', name='Log loss', exact=True).click()
            expect(page.get_by_label('Net profit $20.10', exact=True)).to_have_text('+$20.10')
            expect(page.get_by_text('LOSS SAVED', exact=True)).to_have_count(1)
            page.reload()
            expect(page.get_by_label('Net profit $20.10', exact=True)).to_have_text('+$20.10')
            assert page.evaluate('document.fonts.check(\'12px "PressStart2P_400Regular"\')'), 'Pixel font missing offline'
            context.set_offline(False)

            # Change the test copy to simulate a new release; never alter the real export.
            old_keys = page.evaluate('caches.keys()')
            page.evaluate("caches.open('another-app-cache')")
            html = app_root / 'index.html'
            html.write_text(html.read_text().replace('</head>', '<meta name="test-release" content="second" /></head>'))
            worker_file = app_root / 'sw.js'
            worker_file.write_text(re.sub(r'const CACHE_NAME = CACHE_PREFIX \+ "[a-f0-9]+";', 'const CACHE_NAME = CACHE_PREFIX + "test-next-release";', worker_file.read_text()))
            for file in [html, worker_file]:
                stamp = file.stat().st_mtime + 2
                os.utime(file, (stamp, stamp))
            page.evaluate('navigator.serviceWorker.getRegistration().then(r => r.update())')
            page.wait_for_function('navigator.serviceWorker.getRegistration().then(r => !!r.waiting)', timeout=15000)
            page.close()
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if context.service_workers and context.service_workers[-1].evaluate('self.registration.active && self.registration.active.state === "activated" && !self.registration.waiting'):
                    break
                time.sleep(0.05)
            else:
                raise AssertionError('New offline version did not activate after the old app closed')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url)
            expect(page.get_by_label('Net profit $20.10', exact=True)).to_have_text('+$20.10')
            assert page.locator('meta[name="test-release"]').get_attribute('content') == 'second'
            new_keys = page.evaluate('caches.keys()')
            assert 'another-app-cache' in new_keys
            assert all(key not in new_keys for key in old_keys if key.startswith('degen-tracker:'))
            context.set_offline(True)
            page.reload()
            expect(page.get_by_label('Net profit $20.10', exact=True)).to_have_text('+$20.10')
            assert not errors, errors
            browser.close()
            print(f'PASS: manifest, icons, offline font, offline logging/reload, safe updates, and preserved records at {base_path or "/"}')
    finally:
        server.shutdown()
        server.server_close()
