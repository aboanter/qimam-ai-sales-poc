'use strict';

const {field,label,num}=require('./presentation-v4-core');

function isObj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function rowsOf(v){
  if(Array.isArray(v))return v;
  if(!isObj(v))return[];
  for(const k of ['records','rows','data','result','results','items'])if(Array.isArray(v[k]))return v[k];
  return[];
}
function opName(op,i){return String(op?.name||op?.operation||op?.id||op?.label||`operation_${i+1}`)}
function resolveResult(results,name,index){
  if(Array.isArray(results)){
    return results.find((v,i)=>String(v?.name||v?.operation||v?.id||`operation_${i+1}`)===name) ?? results[index];
  }
  if(isObj(results)){
    if(Object.prototype.hasOwnProperty.call(results,name))return results[name];
    return Object.values(results)[index];
  }
  return null;
}
function inferType(values){
  const present=values.filter(v=>v!==null&&v!==undefined);
  if(!present.length)return'unknown';
  const numeric=present.filter(v=>num(v)!==null).length;
  if(numeric===present.length)return'number';
  const many2one=present.filter(v=>Array.isArray(v)&&v.length>=2).length;
  if(many2one===present.length)return'many2one';
  const strings=present.filter(v=>typeof v==='string').map(String);
  if(strings.length===present.length){
    const dates=strings.filter(v=>/^\d{4}-\d{2}(-\d{2})?/.test(v)).length;
    if(dates===strings.length)return'date';
    return'string';
  }
  return'mixed';
}
function fieldProfile(rows,key){
  const vals=rows.map(r=>field(r,key)).filter(v=>v!==undefined);
  const unique=[];const seen=new Set();
  for(const v of vals){const l=label(v);if(l&&!seen.has(l)){seen.add(l);unique.push(l)}if(unique.length>=8)break}
  const nums=vals.map(num).filter(Number.isFinite);
  return{
    name:key,
    type:inferType(vals),
    distinctSample:unique,
    numeric:nums.length?{min:Math.min(...nums),max:Math.max(...nums),sum:nums.reduce((a,b)=>a+b,0)}:undefined
  };
}
function buildDatasetCatalog(plan,results,{sampleRows=2}={}){
  const ops=Array.isArray(plan?.operations)?plan.operations:[];
  const datasets={},catalog=[];
  ops.forEach((op,i)=>{
    const name=opName(op,i),raw=resolveResult(results,name,i),rows=rowsOf(raw);
    datasets[name]={rows};
    const keys=[...new Set(rows.flatMap(r=>isObj(r)?Object.keys(r):[]))];
    catalog.push({
      name,
      rowCount:rows.length,
      model:String(op?.arguments?.model||op?.model||''),
      method:String(op?.tool||op?.method||op?.name||''),
      groupby:Array.isArray(op?.arguments?.groupby)?op.arguments.groupby:[],
      fields:keys.map(k=>fieldProfile(rows,k)),
      sample:rows.slice(0,Math.max(0,Math.min(Number(sampleRows)||0,3)))
    });
  });
  return{datasets,catalog};
}
function compactCatalog(catalog,{includeSamples=false}={}){
  return(catalog||[]).map(d=>({
    name:d.name,rowCount:d.rowCount,model:d.model,groupby:d.groupby,
    fields:(d.fields||[]).map(f=>({name:f.name,type:f.type,distinctSample:(f.distinctSample||[]).slice(0,4)})),
    ...(includeSamples?{sample:d.sample}: {})
  }));
}
function catalogText(catalog){return JSON.stringify(compactCatalog(catalog),null,0)}

module.exports={buildDatasetCatalog,compactCatalog,catalogText,rowsOf,opName};
