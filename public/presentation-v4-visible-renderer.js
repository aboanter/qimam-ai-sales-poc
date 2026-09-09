// Qimam Presentation V4 visible-only layout adapter.
// Loaded only when QIMAM_PRESENTATION_V4_VISIBLE=1. It does not affect V3 production.
(function(){
  const upstreamRender=window.render;
  if(typeof upstreamRender!=='function')return;

  const STYLE_ID='qimam-presentation-v4-visible-css';
  if(!document.getElementById(STYLE_ID)){
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
.qimam-v4-visible .lay-stack>.layout-ref{width:100%;height:auto!important;min-width:0}
.qimam-v4-visible .tablewrap{width:100%;max-width:100%;overflow-x:auto}
.qimam-v4-visible .tablewrap table{width:100%!important;min-width:100%!important;table-layout:auto}
.qimam-v4-visible .tablewrap th,.qimam-v4-visible .tablewrap td{white-space:normal;overflow-wrap:anywhere;vertical-align:top}
.qimam-v4-visible .insight{height:auto!important;min-height:0}
.qimam-v4-visible .insight ul{margin-block:8px 0}
@media(max-width:620px){
  .qimam-v4-visible .tablewrap table{font-size:12px}
  .qimam-v4-visible .tablewrap th,.qimam-v4-visible .tablewrap td{padding:8px 6px}
}
`;
    document.head.appendChild(s);
  }

  const LAYOUTS=new Set(['wide','grid','split','stack','strip']);
  function safeId(v,fallback){const s=String(v||fallback||'section').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60);return s||fallback||'section'}
  function groups(schema){
    const map=new Map();
    const loose=[];
    for(const [i,c] of (schema?.components||[]).entries()){
      const sec=c?.section;
      if(!sec||!sec.id){loose.push(c);continue}
      const id=safeId(sec.id,`section_${i+1}`);
      if(!map.has(id))map.set(id,{meta:sec,items:[]});
      map.get(id).items.push(c);
    }
    const out=[...map.values()].sort((a,b)=>(Number(a.meta?.order)||0)-(Number(b.meta?.order)||0));
    if(loose.length)out.push({meta:{id:'v4_other',layout:'stack',order:999},items:loose});
    return out;
  }
  function innerFor(g){
    const refs=g.items.map(c=>({type:'ref',id:c.id}));
    const layout=LAYOUTS.has(g.meta?.layout)?g.meta.layout:'stack';
    if(layout==='grid')return{type:'grid',columns:Math.max(2,Math.min(Number(g.meta?.columns)||2,4)),gap:'md',children:refs};
    if(layout==='split'){
      const first=refs.slice(0,2);
      const extra=refs.slice(2);
      const split={type:'split',ratio:g.meta?.ratio||'1:1',gap:'md',children:first};
      return extra.length?{type:'stack',gap:'md',children:[split,...extra]}:split;
    }
    if(layout==='strip')return{type:'strip',gap:'md',children:refs};
    return{type:'stack',gap:'md',children:refs};
  }
  function buildV4Tree(schema){
    const gs=groups(schema);
    if(!gs.length)return null;
    return gs.map(g=>({type:'section',variant:'plain',gap:'md',children:[innerFor(g)]}));
  }

  window.render=function presentationV4VisibleRender(schema,host){
    if(!schema?.presentationV4)return upstreamRender(schema,host);
    const originalTree=schema.layoutTree;
    const tree=buildV4Tree(schema);
    if(tree) schema.layoutTree=tree;
    const result=upstreamRender(schema,host);
    schema.layoutTree=originalTree;
    host?.classList?.add('qimam-v4-visible');
    schema.presentationV4.layoutAdapterVersion='1.0';
    return result;
  };

  window.__QIMAM_PRESENTATION_V4_VISIBLE__={buildV4Tree};
})();
