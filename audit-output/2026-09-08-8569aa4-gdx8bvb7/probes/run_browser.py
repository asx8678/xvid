#!/usr/bin/env python3
"""Run a finite, fresh-profile, local-only Chromium audit fixture."""
import pathlib,sys,subprocess,tempfile,json,re,html,hashlib
snapshot=pathlib.Path(sys.argv[1]).resolve()
output=pathlib.Path(sys.argv[2]).resolve()
scratch=pathlib.Path(sys.argv[3]).resolve()
prelude="""window.auditMessages=[];
window.chrome={runtime:{lastError:undefined,sendMessage(message,callback){window.auditMessages.push({message,callback});if(message.action==='adMarkerRot'&&callback)callback();}}};
const originalAddEventListener=document.addEventListener.bind(document);
document.addEventListener=function(type,handler,options){if(type==='click')window.auditClickHandler=handler;return originalAddEventListener(type,handler,options);};
"""
content=(snapshot/'content.js').read_text()
css=(snapshot/'content.css').read_text()
checks=(output/'probes/dom-checks.js').read_text()
fixture=scratch/'dom-fixture.html'
fixture.write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; media-src \'none\';"><style>'+css+'</style><main id="fixture"></main><script>'+prelude+'</script><script>'+content+'</script><script>'+checks+'</script>')
profile=tempfile.mkdtemp(prefix='chromium-profile-',dir=scratch)
cmd=['chromium','--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
     '--disable-background-networking','--disable-component-update','--disable-sync',
     '--no-first-run','--no-default-browser-check','--disable-extensions',
     '--host-resolver-rules=MAP * ~NOTFOUND','--proxy-server=http://127.0.0.1:9',
     '--proxy-bypass-list=<-loopback>','--disable-features=OptimizationHints,MediaRouter',
     '--user-data-dir='+profile,'--virtual-time-budget=6000','--dump-dom',fixture.as_uri()]
(output/'browser-command.json').write_text(json.dumps({'argv':cmd,'cwd':str(scratch),'timeout_seconds':25,'isolation':'fresh disposable profile; proxy sink and DNS block; page CSP disallows all connections; no live extension APIs'},indent=2)+'\n')
try:
    result=subprocess.run(cmd,cwd=scratch,capture_output=True,text=True,timeout=25)
except subprocess.TimeoutExpired as err:
    print('TIMED OUT after 25 seconds');sys.exit(124)
# stderr contains browser environment diagnostics, not source or personal data.
(output/'browser-stderr.txt').write_text(result.stderr)
match=re.search(r'<pre id="audit-result">(.*?)</pre>',result.stdout,re.S)
if not match:
    print('No result artifact. Browser exit:',result.returncode)
    print(result.stderr[-2000:]);sys.exit(2)
report=json.loads(html.unescape(match.group(1)))
report['browser_exit_code']=result.returncode
report['content_sha256']=hashlib.sha256(content.encode()).hexdigest()
report['stylesheet_sha256']=hashlib.sha256(css.encode()).hexdigest()
(output/'browser-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
sys.exit(1 if report['failed'] else result.returncode)
