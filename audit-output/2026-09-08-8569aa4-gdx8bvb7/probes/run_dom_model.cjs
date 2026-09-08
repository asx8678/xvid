// Audit-only DOM model. No real browser, X endpoint, extension, or download.
const fs=require('node:fs'), path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require(path.join(process.argv[4],'node_modules/jsdom'));
const snapshot=process.argv[2],output=process.argv[3];
const css=fs.readFileSync(path.join(snapshot,'content.css'),'utf8');
const source=fs.readFileSync(path.join(snapshot,'content.js'),'utf8');
const checks=fs.readFileSync(path.join(output,'probes/dom-checks.js'),'utf8');
const dom=new JSDOM('<!doctype html><style>'+css+'</style><main id="fixture"></main>',{
  runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.invalid/synthetic-fixture'
});
const w=dom.window;
w.fetch=()=>{throw Error('Network is forbidden in audit');};
w.XMLHttpRequest=function(){throw Error('Network is forbidden in audit');};
w.WebSocket=function(){throw Error('Network is forbidden in audit');};
// jsdom has no layout; explicitly model only display:none ancestry for ad fixtures.
Object.defineProperty(w.HTMLElement.prototype,'offsetParent',{
  get(){
    if(!this.isConnected)return null;
    for(let el=this;el;el=el.parentElement)if(w.getComputedStyle(el).display==='none')return null;
    return this.parentElement;
  }
});
w.auditMessages=[];
w.chrome={runtime:{lastError:undefined,sendMessage(message,callback){
  w.auditMessages.push({message,callback});
  if(message.action==='adMarkerRot'&&callback)callback();
}}};
const add=w.document.addEventListener.bind(w.document);
w.document.addEventListener=function(type,fn,options){
  if(type==='click')w.auditClickHandler=fn;
  return add(type,fn,options);
};
const context=dom.getInternalVMContext();
vm.runInContext(source,context,{filename:'content.js',timeout:1000});
const task=vm.runInContext(checks,context,{filename:'audit-dom-checks.js',timeout:1000});
Promise.resolve(task).then(()=>{
  const report=JSON.parse(w.document.getElementById('audit-result').textContent);
  report.method='jsdom 30.0.1 DOM model; unchanged content.js/content.css; no resource loading; chrome messaging stubbed; offsetParent explicitly models display:none ancestry because there is no layout. Not Chrome validation. DOM-11 invokes the captured handler using a synthetic event record and controlled timers.';
  report.results=report.results.map(row=>({...row,name:row.name.replace('native DOM ','DOM ').replace('native MutationObserver','MutationObserver model').replace('native CSS','CSS model')}));
  fs.writeFileSync(path.join(output,'dom-model-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  dom.window.close();
  process.exitCode=report.failed?1:0;
}).catch(err=>{console.error(err.stack);dom.window.close();process.exitCode=2;});
