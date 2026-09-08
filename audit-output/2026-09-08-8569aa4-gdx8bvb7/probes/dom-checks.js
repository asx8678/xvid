// Audit-only browser fixture. Uses the unchanged content script and CSS.
(async () => {
  const rows = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = async (name, fn) => {
    try { const details=await fn(); rows.push({name,status:'passed',details:details ?? null}); }
    catch(err) { rows.push({name,status:'failed',error:err.message}); }
  };
  const eq = (actual, expected, context) => {
    if (actual !== expected) throw Error(context + ': expected ' + JSON.stringify(expected) + ', observed ' + JSON.stringify(actual));
  };
  function tweet(id, withBar=true) {
    const block=document.createElement('article');
    block.dataset.testid='tweet';
    block.innerHTML='<header><a href="https://x.com/synthetic/status/'+id+'"><time>synthetic time</time></a></header><video></video>';
    if(withBar) {
      const bar=document.createElement('div');bar.setAttribute('role','group');
      bar.innerHTML='<button>A</button><button>B</button><button>C</button><button>D</button>';
      block.append(bar);
    }
    return block;
  }
  function fresh() {
    setObserving(false);
    document.getElementById('fixture').replaceChildren();
    window.auditMessages.length=0;
    nextCanaryAt=0;rotReported=false;
  }
  function show(node) {
    document.getElementById('fixture').append(node);
    queueAddedTweets(node);sweep();
  }
  await check('DOM-01 native DOM initial injection and duplicate prevention', async()=>{
    fresh();const t=tweet('1111111111');show(t);
    eq(t.querySelectorAll('.xvd').length,1,'initial button count');
    eq(ids.get(t.querySelector('.xvd')),'1111111111','bound post ID');
    setObserving(true);await wait(250);
    eq(t.querySelectorAll('.xvd').length,1,'after observer processes own mutation');
    const b=t.querySelector('.xvd');
    eq(b.tagName,'BUTTON','semantic button');
    eq(b.getAttribute('aria-label'),'Download video. Alt or Option-click opens Save As.','accessible name');
  });
  await check('DOM-02 native MutationObserver sees batch inserts and removed buttons', async()=>{
    fresh();setObserving(true);
    const fragment=document.createDocumentFragment();
    for(const id of ['1111111111','2222222222','3333333333'])fragment.append(tweet(id));
    document.getElementById('fixture').append(fragment);
    await wait(250);
    eq(document.querySelectorAll('.xvd').length,3,'batch count');
    document.querySelector('.xvd').remove();await wait(250);
    eq(document.querySelectorAll('.xvd').length,3,'restored button count');
  });
  await check('DOM-03 nested quotes with both action bars preserve independent buttons',()=>{
    fresh();
    const outer=tweet('1111111111'),inner=tweet('2222222222');
    outer.insertBefore(inner,outer.querySelector('[role=group]'));show(outer);
    const buttons=[...outer.querySelectorAll('.xvd')];
    eq(buttons.length,2,'nested count');
    eq(ids.get(inner.querySelector('.xvd')),'2222222222','inner binding');
    eq(hasOwnButton(outer),true,'outer ownership');
  });
  await check('DOM-04 page-owned class does not suppress injection; synthetic DOM click ignored',()=>{
    fresh();const t=tweet('1111111111'),foreign=document.createElement('button');foreign.className='xvd';t.append(foreign);show(t);
    eq(t.querySelectorAll('.xvd').length,2,'foreign and extension buttons');
    const owned=[...t.querySelectorAll('.xvd')].find(b=>ids.has(b));
    owned.click();foreign.click();
    eq(window.auditMessages.length,0,'untrusted synthetic click message count');
  });
  await check('DOM-05 observing helper disconnects and rescan recovers on resume',async()=>{
    fresh();setObserving(false);
    document.getElementById('fixture').append(tweet('1111111111'));
    await wait(250);eq(document.querySelectorAll('.xvd').length,0,'disconnected observer');
    setObserving(true);eq(document.querySelectorAll('.xvd').length,1,'resume scan');
    return 'Calls visibility helper directly; actual hidden-tab transition was not exercised.';
  });
  await check('DOM-06 native CSS hides marked timeline/sidebar ads and retains organic sibling',()=>{
    fresh();
    const root=document.createElement('div');
    root.innerHTML='<div data-testid="cellInnerDiv" id="ad"><div data-testid="placementTracking">synthetic ad</div></div><div data-testid="sidebarColumn"><div data-testid="placementTracking" id="sideAd">synthetic sidebar ad</div><div id="organic">synthetic organic entry</div></div>';
    show(root);
    eq(getComputedStyle(root.querySelector('#ad')).display,'none','timeline marker');
    eq(getComputedStyle(root.querySelector('#sideAd')).display,'none','sidebar marker');
    eq(getComputedStyle(root.querySelector('#organic')).display,'block','organic sibling');
  });
  function fallbackCell() {
    const cell=document.createElement('div');cell.dataset.testid='cellInnerDiv';
    const block=document.createElement('article');block.dataset.testid='tweet';
    block.innerHTML='<header><span>Ad</span></header><div data-testid="tweetText"><span>synthetic sponsor</span></div>';
    cell.append(block);return cell;
  }
  await check('DOM-07 English ad canary hides markerless cell and sends one diagnostic',()=>{
    fresh();const first=fallbackCell();show(first);
    eq(first.style.display,'none','fallback hidden');
    nextCanaryAt=0;show(fallbackCell());
    eq(window.auditMessages.filter(x=>x.message.action==='adMarkerRot').length,1,'canary message count');
  });
  await check('DOM-08 REGRESSION: retained button must follow changed post identity',()=>{
    fresh();const t=tweet('1111111111');show(t);
    t.querySelector('a').href='https://x.com/synthetic/status/2222222222';
    t.querySelector('time').textContent='changed synthetic time';
    queueTweet(t);sweep();
    eq(getTweetId(t),'2222222222','current visible post');
    eq(ids.get(t.querySelector('.xvd')),'2222222222','retained button binding');
  });
  await check('DOM-09 REGRESSION: organic content in a reused ad cell must become visible',()=>{
    fresh();const cell=fallbackCell();show(cell);eq(cell.style.display,'none','ad hidden first');
    cell.replaceChildren(tweet('2222222222'));
    queueAddedTweets(cell);nextCanaryAt=0;sweep();
    eq(getComputedStyle(cell).display,'block','recycled organic cell visibility');
  });
  await check('DOM-10 REGRESSION: temporarily missing outer bar must not use nested quote bar',()=>{
    fresh();const outer=tweet('1111111111',false),inner=tweet('2222222222');
    outer.append(inner);show(outer);
    queueTweet(outer);sweep();queueTweet(outer);sweep();
    const bindings=[...inner.querySelectorAll('.xvd')].map(b=>ids.get(b));
    eq(JSON.stringify(bindings),JSON.stringify(['2222222222']),'inner bar bindings after three sweeps');
  });
  await check('DOM-11 REGRESSION: late response A must not settle newer request B',()=>{
    fresh();const t=tweet('1111111111');show(t);
    const btn=t.querySelector('.xvd');
    const realSetTimeout=window.setTimeout,realClearTimeout=window.clearTimeout;
    const timers=[];window.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};window.clearTimeout=()=>{};
    const click=()=>window.auditClickHandler({
      isTrusted:true,target:btn,altKey:false,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}
    });
    try {
      click();const responseA=window.auditMessages.at(-1).callback;
      timers.find(x=>x.ms===15000).fn();
      click();const responseB=window.auditMessages.at(-1).callback;
      responseA({ok:true});
      responseB({ok:false,err:'Synthetic current request B failed'});
      eq(btn.title,'Synthetic current request B failed','current request feedback after late A reply');
    } finally {window.setTimeout=realSetTimeout;window.clearTimeout=realClearTimeout;}
  });
  setObserving(false);
  const report={method:'Chrome native DOM/CSS/MutationObserver on a local synthetic file; extension messaging stubbed; DOM-11 invokes captured handler with a synthetic event record and controlled timers, not a real user click',results:rows,passed:rows.filter(x=>x.status==='passed').length,failed:rows.filter(x=>x.status==='failed').length};
  const pre=document.createElement('pre');pre.id='audit-result';pre.textContent=JSON.stringify(report,null,2);
  document.body.replaceChildren(pre);
})();
