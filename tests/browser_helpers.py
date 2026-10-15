"""Previously signed-in offline fixtures. Never send test tokens or records to Supabase."""
import json
from pathlib import Path
from urllib.parse import quote
PROJECT = json.loads((Path(__file__).resolve().parents[1] / 'src/cloud/project.public.json').read_text())['url']
USER_ID = '11111111-1111-4111-8111-111111111111'
AUTH_KEY = 'degen-tracker.auth.' + quote(PROJECT, safe='')
ACCOUNT_KEY = 'degen-tracker.account.' + quote(PROJECT, safe='') + '.' + USER_ID + '.v1'

def signed_in_offline(context, records=None):
    # SDK session metadata models an existing login. Cloud requests are always
    # aborted; this cannot authenticate to the real backend or send emails.
    context.route(PROJECT + '/**', lambda route: route.abort('internetdisconnected'))
    context.add_init_script('''(() => {
        if (!['127.0.0.1', 'localhost'].includes(location.hostname)) return;
        const authKey = %s, accountKey = %s;
        if (!localStorage.getItem(authKey)) {
            const expires = Math.floor(Date.now()/1000)+3600;
            const encode = data => btoa(JSON.stringify(data)).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');
            const uid = %s;
            const access = encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,exp:expires,role:'authenticated'})+'.synthetic-offline-signature';
            localStorage.setItem(authKey, JSON.stringify({access_token:access,refresh_token:'synthetic-offline-refresh',
                token_type:'bearer',expires_at:expires,expires_in:3600,user:{id:uid,email:'offline@example.test'}}));
        }
        if (!localStorage.getItem(accountKey)) localStorage.setItem(accountKey, JSON.stringify(%s));
    })();''' % (json.dumps(AUTH_KEY), json.dumps(ACCOUNT_KEY), json.dumps(USER_ID), json.dumps({
        'version':1,'records':records or [],'pending':[],'imported':False,'editEnabled':True})))
