// Background Jobs Client V1 — submit once, let the server continue, resume when the browser returns.
(function(){
  const STORAGE_KEY='qimam_active_background_job_v1';
  const POLL_MS=2500;
  let timer=null,currentId=null,currentCard=null;

  function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function phaseText(p){return ({queued:'تم استلام الطلب وسنبدأ المعالجة',planning:'نحلل السؤال ونبني خطة الاستعلام',querying_odoo:'نجلب البيانات من Odoo',designing_report:'نحلل النتائج ونبني التقرير',done:'اكتمل التقرير',failed:'فشل تنفيذ الطلب'})[p]||'جاري العمل على الطلب'}
  function setStored(id,question){try{if(id)localStorage.setItem(STORAGE_KEY,JSON.stringify({id,question,at:Date.now()}));else localStorage.removeItem(STORAGE_KEY)}catch{}}
  function getStored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}

  function makeCard(question){
    const feed=document.getElementById('feed');if(!feed)return null;
    const card=el('div','card qbgjob-card');
    const q=el('div','q',question);card.append(q);
    const status=el('div','qbgjob-status');
    status.append(el('div','qbgjob-orb'),el('div','qbgjob-copy','يتم تجهيز الطلب في الخلفية…'));
    const note=el('div','qbgjob-note','يمكنك الآن إغلاق الصفحة أو استخدام تطبيق آخر. عند الرجوع سنكمل من نفس الطلب.');
    card.append(status,note);feed.prepend(card);return card;
  }
  function updateCard(card,job){if(!card)return;const copy=card.querySelector('.qbgjob-copy');if(copy)copy.textContent=phaseText(job.phase);const note=card.querySelector('.qbgjob-note');if(note&&job.status==='running')note.textContent='المعالجة مستمرة على السيرفر، ولا تحتاج إبقاء الصفحة مفتوحة.'}
  function showError(card,msg){if(!card)return;const s=card.querySelector('.qbgjob-status');if(s){s.className='qbgjob-status qbgjob-error';s.replaceChildren(el('div','qbgjob-copy',msg||'فشل الطلب'))}const n=card.querySelector('.qbgjob-note');if(n)n.textContent='يمكنك إعادة المحاولة من نفس السؤال.'}
  function showResult(card,job){
    if(!card||!job?.result?.schema)return showError(card,'اكتمل الطلب لكن لم تصل نتيجة قابلة للعرض.');
    card.querySelector('.qbgjob-status')?.remove();card.querySelector('.qbgjob-note')?.remove();
    const host=el('div','qbgjob-result');card.append(host);
    try{if(typeof window.render==='function')window.render(job.result.schema,host);else throw new Error('Renderer is not ready');}
    catch(e){showError(card,'تعذر عرض التقرير: '+e.message);return}
    const details=document.createElement('details');details.className='debug';const sum=document.createElement('summary');sum.textContent='JSON';const pre=document.createElement('pre');pre.textContent=JSON.stringify(job.result.schema,null,2);details.append(sum,pre);card.append(details);
  }

  async function getJob(id){const r=await fetch('/api/jobs/'+encodeURIComponent(id),{cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر استرجاع حالة الطلب');return d.job}
  async function poll(){
    if(!currentId)return;
    try{
      const job=await getJob(currentId);updateCard(currentCard,job);
      if(job.status==='done'){clearTimeout(timer);timer=null;showResult(currentCard,job);setStored(null);currentId=null;return}
      if(job.status==='failed'){clearTimeout(timer);timer=null;showError(currentCard,job.error?.message||'فشل الطلب');setStored(null);currentId=null;return}
    }catch(e){
      // Network loss or iOS suspension should not destroy the job. Keep the id and retry later.
      if(document.visibilityState==='visible')updateCard(currentCard,{phase:'queued'});
    }
    clearTimeout(timer);timer=setTimeout(poll,POLL_MS);
  }

  async function submit(question){
    if(currentId)return;
    currentCard=makeCard(question);
    try{
      const r=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر بدء الطلب');
      currentId=d.job.id;setStored(currentId,question);updateCard(currentCard,d.job);poll();
    }catch(e){showError(currentCard,e.message)}
  }

  function install(){
    const button=document.getElementById('go'),input=document.getElementById('q');if(!button||!input)return;
    document.addEventListener('click',function(ev){
      const b=ev.target&&ev.target.closest?ev.target.closest('#go'):null;if(!b)return;
      ev.preventDefault();ev.stopImmediatePropagation();
      const question=String(input.value||'').trim();if(!question)return;
      submit(question);
    },true);

    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentId){clearTimeout(timer);poll()}});
    window.addEventListener('pageshow',()=>{if(currentId){clearTimeout(timer);poll()}});

    const saved=getStored();if(saved?.id){currentId=saved.id;currentCard=makeCard(saved.question||'استكمال الطلب السابق');poll()}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  if(!document.getElementById('qimam-background-jobs-v1-css')){
    const s=document.createElement('style');s.id='qimam-background-jobs-v1-css';s.textContent=`
.qbgjob-status{display:flex;align-items:center;gap:14px;padding:18px;border-radius:18px;background:#f6fbfb;border:1px solid #dceced}.qbgjob-orb{width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg,#0b9da6,#087789);box-shadow:0 9px 24px rgba(11,157,166,.18);animation:qbgpulse 1.6s ease-in-out infinite;flex:0 0 auto}.qbgjob-copy{font-weight:800;color:#173b54;line-height:1.7}.qbgjob-note{margin-top:10px;color:#648092;font-size:12px;line-height:1.8}.qbgjob-error{background:#fef2f2;border-color:#fee2e2}.qbgjob-error .qbgjob-copy{color:#991b1b}.qbgjob-result{min-width:0}@keyframes qbgpulse{50%{transform:scale(1.06);opacity:.78}}
`;
    document.head.appendChild(s);
  }
})();
