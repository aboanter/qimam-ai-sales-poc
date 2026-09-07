// Background Jobs Client V1.3 — stale jobs self-heal; browser sleep never blocks a new question.
(function(){
  const STORAGE_KEY='qimam_active_background_job_v1';
  const POLL_MS=2500;
  let timer=null,currentId=null,currentCard=null,polling=false;

  function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function phaseText(p){return ({queued:'تم استلام الطلب وسنبدأ المعالجة',planning:'نحلل السؤال ونبني خطة الاستعلام',querying_odoo:'نجلب البيانات من Odoo',designing_report:'نحلل النتائج ونبني التقرير',done:'اكتمل التقرير',failed:'فشل تنفيذ الطلب'})[p]||'جاري العمل على الطلب'}
  function setStored(id,question){try{if(id)localStorage.setItem(STORAGE_KEY,JSON.stringify({id,question,at:Date.now()}));else localStorage.removeItem(STORAGE_KEY)}catch{}}
  function getStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
  function timeLabel(){return new Intl.DateTimeFormat('ar-SA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())}
  function activityDots(){const w=el('span','qbgjob-dots');w.append(el('i'),el('i'),el('i'));return w}
  function unlockInput(){const input=document.getElementById('q'),button=document.getElementById('go');if(input)input.disabled=false;if(button)button.disabled=false}

  function makeCard(question){
    const feed=document.getElementById('feed');if(!feed)return null;
    const card=el('div','card qbgjob-card');
    card.append(el('div','q',question));
    const status=el('div','qbgjob-status'),orb=el('div','qbgjob-orb'),body=el('div','qbgjob-status-body');
    const line=el('div','qbgjob-line');line.append(el('div','qbgjob-copy','يتم تجهيز الطلب في الخلفية…'),activityDots());
    body.append(line,el('div','qbgjob-checked','بانتظار أول تحديث…'));status.append(orb,body);
    const actions=el('div','qbgjob-actions');
    const refresh=el('button','qbgjob-refresh','↻ تحديث الحالة الآن');refresh.type='button';refresh.onclick=()=>{if(currentId){clearTimeout(timer);poll(true)}};
    const fresh=el('button','qbgjob-new','＋ بدء سؤال جديد');fresh.type='button';fresh.onclick=()=>abandonCurrent(true);
    actions.append(refresh,fresh);
    card.append(status,actions,el('div','qbgjob-note','يمكنك إغلاق الصفحة أو استخدام تطبيق آخر. عند الرجوع سنستأنف متابعة نفس الطلب.'));
    feed.prepend(card);return card;
  }
  function setChecking(card,on){const b=card?.querySelector('.qbgjob-refresh');if(b){b.disabled=!!on;b.textContent=on?'جارٍ التحقق…':'↻ تحديث الحالة الآن'}}
  function updateCard(card,job){if(!card)return;const c=card.querySelector('.qbgjob-copy');if(c)c.textContent=phaseText(job.phase);const checked=card.querySelector('.qbgjob-checked');if(checked){const age=job.updatedAt?Math.max(0,Math.round((Date.now()-job.updatedAt)/1000)):null;checked.textContent=`آخر تحقق: ${timeLabel()}${age!=null?' · تحديث السيرفر قبل '+age+' ث':''}`;}const note=card.querySelector('.qbgjob-note');if(note&&job.status==='running')note.textContent='المعالجة مستمرة على السيرفر. يمكنك الخروج من Safari والرجوع لاحقاً.'}
  function showTransient(card,msg){const x=card?.querySelector('.qbgjob-checked');if(x)x.textContent=msg+' · سنحاول تلقائياً مرة أخرى.'}
  function showError(card,msg){if(!card)return;const s=card.querySelector('.qbgjob-status');if(s){s.className='qbgjob-status qbgjob-error';s.replaceChildren(el('div','qbgjob-copy',msg||'فشل الطلب'))}card.querySelector('.qbgjob-refresh')?.remove();const n=card.querySelector('.qbgjob-note');if(n)n.textContent='يمكنك بدء سؤال جديد مباشرة.';unlockInput()}
  function showResult(card,job){
    if(!card||!job?.result?.schema)return showError(card,'اكتمل الطلب لكن لم تصل نتيجة قابلة للعرض.');
    card.querySelector('.qbgjob-status')?.remove();card.querySelector('.qbgjob-actions')?.remove();card.querySelector('.qbgjob-note')?.remove();
    const host=el('div','qbgjob-result');card.append(host);
    try{if(typeof window.render==='function')window.render(job.result.schema,host);else throw new Error('Renderer is not ready')}catch(e){showError(card,'تعذر عرض التقرير: '+e.message);return}
    const details=document.createElement('details');details.className='debug';const sum=document.createElement('summary');sum.textContent='JSON';const pre=document.createElement('pre');pre.textContent=JSON.stringify(job.result.schema,null,2);details.append(sum,pre);card.append(details);unlockInput();
  }
  function staleJobCleanup(){
    clearTimeout(timer);timer=null;setStored(null);currentId=null;polling=false;unlockInput();
    if(currentCard){currentCard.remove();currentCard=null}
  }

  async function getJob(id){
    const r=await fetch('/api/jobs/'+encodeURIComponent(id)+'?t='+Date.now(),{cache:'no-store',headers:{'cache-control':'no-cache'}});
    const d=await r.json().catch(()=>({}));
    if(r.status===404){const e=new Error('STALE_JOB');e.code='NOT_FOUND';throw e}
    if(!r.ok)throw new Error(d.error||'تعذر استرجاع حالة الطلب');return d.job;
  }
  function schedule(){clearTimeout(timer);if(currentId)timer=setTimeout(()=>poll(false),POLL_MS)}
  async function poll(manual=false){
    if(!currentId||polling)return;
    polling=true;setChecking(currentCard,true);
    try{
      const job=await getJob(currentId);updateCard(currentCard,job);
      if(job.status==='done'){clearTimeout(timer);timer=null;showResult(currentCard,job);setStored(null);currentId=null;return}
      if(job.status==='failed'){clearTimeout(timer);timer=null;showError(currentCard,job.error?.message||'فشل الطلب');setStored(null);currentId=null;return}
    }catch(e){
      if(e.code==='NOT_FOUND'){staleJobCleanup();return}
      showTransient(currentCard,manual?('تعذر التحديث: '+e.message):'الاتصال متوقف مؤقتاً');
    }finally{
      polling=false;setChecking(currentCard,false);if(currentId)schedule();
    }
  }

  async function abandonCurrent(removeCard=false){
    const id=currentId;clearTimeout(timer);timer=null;currentId=null;polling=false;setStored(null);unlockInput();
    if(id)fetch('/api/jobs/'+encodeURIComponent(id),{method:'DELETE',keepalive:true}).catch(()=>{});
    if(removeCard&&currentCard){currentCard.remove();currentCard=null}
    const input=document.getElementById('q');if(input){input.focus();try{input.setSelectionRange(input.value.length,input.value.length)}catch{}}
  }
  async function submit(question){
    if(currentId)return;
    currentCard=makeCard(question);setChecking(currentCard,true);
    try{
      const r=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر بدء الطلب');
      currentId=d.job.id;setStored(currentId,question);updateCard(currentCard,d.job);poll(false);
    }catch(e){showError(currentCard,e.message);currentId=null;setStored(null)}finally{setChecking(currentCard,false)}
  }
  function resumeNow(){if(!currentId)return;clearTimeout(timer);timer=null;poll(true)}
  function install(){
    const input=document.getElementById('q'),button=document.getElementById('go');if(!input||!button)return;
    document.addEventListener('click',function(ev){const b=ev.target?.closest?.('#go');if(!b)return;ev.preventDefault();ev.stopImmediatePropagation();const question=String(input.value||'').trim();if(!question)return;if(currentId){if(!window.confirm('يوجد طلب سابق قيد المتابعة. هل تريد تركه وبدء السؤال الجديد؟'))return;abandonCurrent(true).then(()=>submit(question));return}submit(question)},true);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeNow()});
    window.addEventListener('pageshow',resumeNow);window.addEventListener('focus',resumeNow);window.addEventListener('online',resumeNow);
    const saved=getStored();if(saved?.id){currentId=saved.id;currentCard=makeCard(saved.question||'استكمال الطلب السابق');poll(true)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  if(!document.getElementById('qimam-background-jobs-v1-css')){
    const s=document.createElement('style');s.id='qimam-background-jobs-v1-css';s.textContent=`
.qbgjob-status{display:flex;align-items:center;gap:14px;padding:18px;border-radius:18px;background:#f6fbfb;border:1px solid #dceced}.qbgjob-status-body{min-width:0;flex:1}.qbgjob-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.qbgjob-orb{width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg,#0b9da6,#087789);box-shadow:0 9px 24px rgba(11,157,166,.18);animation:qbgpulse 1.6s ease-in-out infinite;flex:0 0 auto}.qbgjob-copy{font-weight:800;color:#173b54;line-height:1.7}.qbgjob-checked{margin-top:4px;color:#78909f;font-size:11px;line-height:1.5}.qbgjob-dots{display:inline-flex;gap:5px}.qbgjob-dots i{width:7px;height:7px;border-radius:50%;background:#0b9da6;animation:qbgdot 1.1s infinite}.qbgjob-dots i:nth-child(2){animation-delay:.18s}.qbgjob-dots i:nth-child(3){animation-delay:.36s}.qbgjob-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.qbgjob-refresh,.qbgjob-new{border:1px solid #b9dfe1;background:#fff;color:#087f88;border-radius:12px;padding:10px 13px;font:inherit;font-size:12px;font-weight:800}.qbgjob-new{border-color:#d7e2e5;color:#36566a;background:#f9fbfc}.qbgjob-refresh:disabled{opacity:.55}.qbgjob-note{margin-top:10px;color:#648092;font-size:12px;line-height:1.8}.qbgjob-error{background:#fef2f2;border-color:#fee2e2}.qbgjob-error .qbgjob-copy{color:#991b1b}.qbgjob-result{min-width:0}@keyframes qbgpulse{50%{transform:scale(1.06);opacity:.78}}@keyframes qbgdot{0%,100%{transform:scale(.72);opacity:.35}50%{transform:scale(1.15);opacity:1}}
@media(max-width:620px){.qbgjob-status{align-items:flex-start;padding:15px}.qbgjob-actions{grid-template-columns:1fr}.qbgjob-refresh,.qbgjob-new{width:100%;padding:11px}}
`;document.head.appendChild(s)
  }
})();
