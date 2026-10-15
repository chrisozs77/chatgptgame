"""Play the real MP3; check autoplay fallback, persistent mute, fixed controls and offline ranges."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import os
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect
from browser_helpers import ACCOUNT_KEY, signed_in_offline

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--directory',default='dist')
parser.add_argument('--base-path',default='')
args=parser.parse_args()
base_path=args.base_path.rstrip('/')
folder=tempfile.TemporaryDirectory(prefix='degen-music-test-')
host_root=Path(folder.name)
shutil.copytree((root/args.directory).resolve(),host_root/base_path.lstrip('/') if base_path else host_root,dirs_exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(host_root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'+base_path+'/'
spy='''(() => {
  const NativeAudio=window.Audio; window.__music=[];
  window.Audio=function(...args) {const media=new NativeAudio(...args); window.__music.push(media); return media;};
  window.Audio.prototype=NativeAudio.prototype;
})();'''
audio='window.__music[window.__music.length-1]'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),
            args=['--no-sandbox','--autoplay-policy=user-gesture-required'])
        context=browser.new_context(viewport={'width':390,'height':844})
        signed_in_offline(context); context.add_init_script(spy+'''
          // Make the blocked-autoplay condition deterministic in headless Chromium.
          // Successful playback below still uses the actual MP3 and media decoder.
          window.__musicInteraction=false;
          const interacted=event => {if(event.isTrusted) window.__musicInteraction=true;};
          document.addEventListener('pointerup',interacted,true);
          document.addEventListener('keydown',interacted,true);
          const nativePlay=HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play=function() {
            if(!window.__musicInteraction)
              return Promise.reject(new DOMException('User interaction required','NotAllowedError'));
            return nativePlay.call(this);
          };
        ''')
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(origin)
        # Fresh preferences default on, but browser policy is respected.
        mute=page.get_by_role('button',name='Mute background music',exact=True)
        expect(mute).to_be_visible()
        expect(page.get_by_text('Tap the page to start audio',exact=True)).to_be_visible()
        assert page.evaluate(audio+'.paused')
        page.get_by_role('heading',name='DEGEN',exact=True).click()
        page.wait_for_function('!'+audio+'.paused && '+audio+'.currentTime > 0')
        assert page.evaluate(audio+'.loop')
        assert page.evaluate(audio+'.volume')==0.6
        duration=page.evaluate(audio+'.duration'); assert 105<duration<107,duration
        page.evaluate(audio+'.currentTime = '+audio+'.duration - 0.15')
        page.wait_for_function(audio+'.currentTime < 2')
        page.get_by_role('textbox',name='Amount in US dollars').fill('4.25')
        page.get_by_role('button',name='Log gain',exact=True).click()
        expect(page.get_by_label('Net profit $4.25',exact=True)).to_have_text('+$4.25')
        saved=page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')")
        position=mute.bounding_box()['y']
        page.get_by_text('YOUR LOGS. YOUR SCOREBOARD.',exact=True).scroll_into_view_if_needed()
        assert abs(mute.bounding_box()['y']-position)<1
        mute.click()
        page.wait_for_function(audio+'.paused')
        page.wait_for_function("localStorage.getItem('degen-tracker.music.v1')==='off'")
        off=page.get_by_role('button',name='Unmute background music',exact=True)
        expect(off).to_be_visible()
        page.get_by_role('tab',name='History',exact=True).click()
        assert page.evaluate(audio+'.paused'),'Muted music restarted on interaction'
        for tab in ['Support','Tracker','History']:
            page.get_by_role('tab',name=tab,exact=True).click()
            for width,height in [(320,844),(390,500),(1200,900)]:
                page.set_viewport_size({'width':width,'height':height})
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                box=off.bounding_box(); nav=page.get_by_role('tab',name='History',exact=True).bounding_box()
                assert box['height']>=44 and box['y']+box['height']<=nav['y']
        page.reload(); expect(off).to_be_visible(); assert page.evaluate(audio+'.paused')
        assert page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')")==saved
        off.click(); page.wait_for_function('!'+audio+'.paused')
        # Backgrounding pauses; focus only resumes when the preference is on.
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.wait_for_function(audio+'.paused')
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        page.wait_for_function('!'+audio+'.paused')
        mute.click()
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        assert page.evaluate(audio+'.paused')
        # Installed assets support offline MP3 decoding and Safari's range requests.
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        context.set_offline(True)
        page.reload(); expect(off).to_be_visible()
        off.click(); page.wait_for_function('!'+audio+'.paused && '+audio+'.currentTime > 0')
        ranges=page.evaluate('''async () => {
          const url=window.__music[window.__music.length-1].src;
          const full=new Uint8Array(await (await fetch(url)).arrayBuffer());
          const result=[];
          for(const range of ['bytes=0-15','bytes=-8','bytes='+full.length+'-']) {
            const response=await fetch(url,{headers:{Range:range}});
            result.push({status:response.status,range:response.headers.get('Content-Range'),
              bytes:Array.from(new Uint8Array(await response.arrayBuffer()))});
          }
          return {length:full.length,first:Array.from(full.slice(0,16)),last:Array.from(full.slice(-8)),result};
        }''')
        assert ranges['result'][0]=={'status':206,'range':f"bytes 0-15/{ranges['length']}",'bytes':ranges['first']},ranges
        assert ranges['result'][1]['status']==206 and ranges['result'][1]['bytes']==ranges['last'],ranges
        assert ranges['result'][2]['status']==416,ranges
        mute.click(); page.get_by_role('tab',name='Tracker',exact=True).click()
        # Even a failed preference save must silence immediately and protect logs.
        off.click(); page.wait_for_function('!'+audio+'.paused')
        page.evaluate('''() => {const original=Storage.prototype.setItem; Storage.prototype.setItem=function(key,value) {
          if(key==='degen-tracker.music.v1') throw new Error('Simulated preference failure');
          return original.call(this,key,value); };}''')
        mute.click(); page.wait_for_function(audio+'.paused')
        expect(page.get_by_role('alert')).to_contain_text('preference couldn’t be saved')
        assert page.evaluate(f"localStorage.getItem('{ACCOUNT_KEY}')")==saved
        assert not errors,errors
        context.close(); browser.close()
        # Browsers that allow autoplay actually begin playing without a click.
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),
            args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        context=browser.new_context(); signed_in_offline(context); context.add_init_script(spy)
        page=context.new_page(); page.goto(origin)
        page.wait_for_function('window.__music.length && !'+audio+'.paused && '+audio+'.currentTime > 0')
        expect(page.get_by_role('button',name='Mute background music',exact=True)).to_be_visible()
        context.close(); browser.close()
        print(f'PASS: real MP3 playback/loop, low volume, allowed/blocked autoplay, first interaction, fixed controls, persistent immediate mute, background handling, offline audio/ranges, storage-failure isolation at {base_path or "/"}.')
finally:
    server.shutdown(); server.server_close()
    folder.cleanup()
