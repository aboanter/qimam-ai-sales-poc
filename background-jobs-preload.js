// Background Jobs V1.4 — direct in-process execution + per-phase performance instrumentation.
const express = require('express');
const crypto = require('crypto');

const originalListen = express.application.listen;
const originalPost = express.application.post;
const captured = new Map();
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;
const PHASE_TIMEOUTS = { planning: 120000, querying_odoo: 180000, designing_report: 420000 };

express.application.post = function captureCoreRoutes(path, ...handlers) {
  if (['/api/plan','/api/execute','/api/present'].includes(path) && handlers.length) captured.set(path, handlers[handlers.length - 1]);
  return originalPost.call(this, path, ...handlers);
};

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id, status: job.status, phase: job.phase, failedPhase: job.failedPhase || undefined,
    question: job.question, createdAt: job.createdAt, updatedAt: job.updatedAt,
    performance: job.performance || undefined,
    result: job.status === 'done' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined,
  };
}

function cleanJobs() { const now=Date.now(); for (const [id,job] of jobs) if (now-job.updatedAt>JOB_TTL_MS) jobs.delete(id); }
setInterval(cleanJobs,5*60*1000).unref();

function withTimeout(promise, timeoutMs, phase) {
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(`انتهت مهلة مرحلة ${phase}. يمكنك بدء الطلب من جديد.`);e.code='PHASE_TIMEOUT';reject(e)},timeoutMs)})]).finally(()=>clearTimeout(timer));
}

function invokeRoute(path, body) {
  const handler=captured.get(path);
  if(typeof handler!=='function')return Promise.reject(new Error(`Core route handler not ready: ${path}`));
  return new Promise((resolve,reject)=>{
    let settled=false; const finish=(fn,value)=>{if(!settled){settled=true;fn(value)}};
    const req={body:body||{}};
    const res={statusCode:200,status(code){this.statusCode=code;return this},json(payload){if(this.statusCode>=400){const e=new Error(payload?.error||`HTTP ${this.statusCode}`);e.status=this.statusCode;e.detail=payload?.detail;finish(reject,e)}else finish(resolve,payload);return this},send(payload){finish(resolve,payload);return this},end(){finish(resolve,undefined);return this}};
    try{const out=handler(req,res);if(out&&typeof out.then==='function')out.catch(e=>finish(reject,e))}catch(e){finish(reject,e)}
  });
}

function ensureActive(job){if(!job||job.cancelled){const e=new Error('Job cancelled');e.code='JOB_CANCELLED';throw e}}
function roundSeconds(ms){return Math.round(ms/100)/10}

async function runPhase(job, phase, path, body) {
  ensureActive(job);
  job.status='running';job.phase=phase;job.updatedAt=Date.now();
  job.performance=job.performance||{version:'1.0',phases:{}};
  const started=Date.now();
  job.performance.phases[phase]={startedAt:started,status:'running'};
  try{
    const value=await withTimeout(invokeRoute(path,body),PHASE_TIMEOUTS[phase],phase);
    const ended=Date.now();
    job.performance.phases[phase]={startedAt:started,endedAt:ended,durationMs:ended-started,durationSeconds:roundSeconds(ended-started),status:'done'};
    job.updatedAt=ended;
    console.log(`[PERF] job=${job.id} phase=${phase} duration=${roundSeconds(ended-started)}s`);
    return value;
  }catch(e){
    const ended=Date.now();
    job.performance.phases[phase]={startedAt:started,endedAt:ended,durationMs:ended-started,durationSeconds:roundSeconds(ended-started),status:'failed'};
    throw e;
  }
}

async function runJob(job) {
  const totalStarted=Date.now(); let activePhase='planning';
  try{
    activePhase='planning'; const planned=await runPhase(job,activePhase,'/api/plan',{question:job.question,previousPlan:job.previousPlan||null}); job.plan=planned.plan;
    activePhase='querying_odoo'; const executed=await runPhase(job,activePhase,'/api/execute',{plan:planned.plan});
    activePhase='designing_report'; const presented=await runPhase(job,activePhase,'/api/present',{question:job.question,plan:planned.plan,results:executed.results}); ensureActive(job);
    job.status='done';job.phase='done';job.result={schema:presented.schema,plan:planned.plan,results:executed.results,model:presented.model,source:executed.source||'live_odoo_mcp'};job.updatedAt=Date.now();
    job.performance.totalMs=job.updatedAt-totalStarted;job.performance.totalSeconds=roundSeconds(job.performance.totalMs);job.performance.completedAt=job.updatedAt;
    console.log(`[PERF] job=${job.id} total=${job.performance.totalSeconds}s phases=${JSON.stringify(job.performance.phases)}`);
  }catch(e){
    if(e&&e.code==='JOB_CANCELLED')return;
    job.status='failed';job.failedPhase=activePhase;job.phase='failed';job.error={message:e?.message||'Background job failed',detail:e?.detail,code:e?.code};job.updatedAt=Date.now();
    job.performance=job.performance||{version:'1.0',phases:{}};job.performance.totalMs=job.updatedAt-totalStarted;job.performance.totalSeconds=roundSeconds(job.performance.totalMs);job.performance.completedAt=job.updatedAt;
  }
}

express.application.listen=function backgroundJobListen(...args){
  const app=this;
  app.post('/api/jobs',(req,res)=>{const {question,previousPlan}=req.body||{};if(!question||typeof question!=='string'||question.length>2000)return res.status(400).json({error:'A question string (max 2000 chars) is required.'});const id=crypto.randomUUID(),now=Date.now();const job={id,question,previousPlan:previousPlan||null,status:'queued',phase:'queued',createdAt:now,updatedAt:now,result:null,error:null,cancelled:false,performance:{version:'1.0',phases:{}}};jobs.set(id,job);res.status(202).json({job:publicJob(job)});setImmediate(()=>runJob(job))});
  app.get('/api/jobs/:id',(req,res)=>{const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:'Job not found or expired.'});return res.json({job:publicJob(job)})});
  app.delete('/api/jobs/:id',(req,res)=>{const job=jobs.get(req.params.id);if(job){job.cancelled=true;jobs.delete(req.params.id)}return res.status(204).end()});
  express.application.post=originalPost;
  return originalListen.apply(this,args);
};

require('./planner-preload.js');
