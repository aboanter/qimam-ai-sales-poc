'use strict';
const {buildDatasetCatalog}=require('./presentation-v4-catalog');
const {buildArtDirectorPrompt,normalizeDecision,estimatePromptSize}=require('./presentation-v4-art-director');
const {buildPresentation,validateManifest}=require('./presentation-v4-core');

function summarizeUi(ui){
  const types={};for(const c of ui?.components||[])types[c.type]=(types[c.type]||0)+1;
  return{components:(ui?.components||[]).length,types};
}
async function runShadow({question,plan,results,analystSummary='',artDirector}){
  if(typeof artDirector!=='function')throw new Error('artDirector function is required');
  const started=Date.now();
  const {datasets,catalog}=buildDatasetCatalog(plan,results,{sampleRows:1});
  const prompt=buildArtDirectorPrompt({question,analystSummary,catalog});
  const promptSize=estimatePromptSize(prompt);
  const llmStart=Date.now();
  const raw=await artDirector({prompt,catalog});
  const llmMs=Date.now()-llmStart;
  let decision;
  try{decision=normalizeDecision(raw)}catch(e){return{ok:false,stage:'parse_decision',errors:[e.message],promptSize,llmMs,totalMs:Date.now()-started};}
  if(decision.decision!=='render'){
    return{ok:true,stage:'decision',decision,promptSize,llmMs,totalMs:Date.now()-started,catalog};
  }
  const manifest=decision.manifest;
  const validation=validateManifest(manifest,datasets);
  if(!validation.ok)return{ok:false,stage:'validate_manifest',errors:validation.errors,manifest,decision,promptSize,llmMs,totalMs:Date.now()-started};
  let presentation;
  try{presentation=buildPresentation(manifest,datasets)}catch(e){return{ok:false,stage:'materialize',errors:[e.message],manifest,decision,promptSize,llmMs,totalMs:Date.now()-started}}
  return{ok:true,stage:'render',decision,manifest,presentation,catalog,promptSize,llmMs,totalMs:Date.now()-started,summary:summarizeUi(presentation)};
}
module.exports={runShadow,summarizeUi};
