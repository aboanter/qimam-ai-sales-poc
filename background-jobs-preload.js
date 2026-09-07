// Background Jobs V1 — decouple long analytics work from the browser request lifecycle.
const express = require('express');
const crypto = require('crypto');

const originalListen = express.application.listen;
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    question: job.question,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.status === 'done' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined,
  };
}

function cleanJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(id);
  }
}
setInterval(cleanJobs, 5 * 60 * 1000).unref();

async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `HTTP ${r.status}`);
    err.detail = data.detail || data.raw;
    throw err;
  }
  return data;
}

async function runJob(job, port) {
  const base = `http://127.0.0.1:${port}`;
  try {
    job.status = 'running';
    job.phase = 'planning';
    job.updatedAt = Date.now();

    const planned = await postJson(`${base}/api/plan`, {
      question: job.question,
      previousPlan: job.previousPlan || null,
    });
    job.plan = planned.plan;

    job.phase = 'querying_odoo';
    job.updatedAt = Date.now();
    const executed = await postJson(`${base}/api/execute`, { plan: planned.plan });

    job.phase = 'designing_report';
    job.updatedAt = Date.now();
    const presented = await postJson(`${base}/api/present`, {
      question: job.question,
      plan: planned.plan,
      results: executed.results,
    });

    job.status = 'done';
    job.phase = 'done';
    job.result = {
      schema: presented.schema,
      plan: planned.plan,
      results: executed.results,
      model: presented.model,
      source: executed.source || 'live_odoo_mcp',
    };
    job.updatedAt = Date.now();
  } catch (e) {
    job.status = 'failed';
    job.phase = 'failed';
    job.error = {
      message: e && e.message ? e.message : 'Background job failed',
      detail: e && e.detail ? e.detail : undefined,
    };
    job.updatedAt = Date.now();
  }
}

express.application.listen = function backgroundJobListen(...args) {
  const app = this;
  const port = Number(process.env.PORT || 3000);

  app.post('/api/jobs', (req, res) => {
    const { question, previousPlan } = req.body || {};
    if (!question || typeof question !== 'string' || question.length > 2000) {
      return res.status(400).json({ error: 'A question string (max 2000 chars) is required.' });
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const job = {
      id,
      question,
      previousPlan: previousPlan || null,
      status: 'queued',
      phase: 'queued',
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
    };
    jobs.set(id, job);
    res.status(202).json({ job: publicJob(job) });
    setImmediate(() => runJob(job, port));
  });

  app.get('/api/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found or expired.' });
    return res.json({ job: publicJob(job) });
  });

  return originalListen.apply(this, args);
};

require('./planner-preload.js');
