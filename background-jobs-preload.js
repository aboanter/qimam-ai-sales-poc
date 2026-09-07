// Background Jobs V1.2 — decouple long analytics work from the browser and never leave a job hanging forever.
const express = require('express');
const crypto = require('crypto');

const originalListen = express.application.listen;
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;
const PHASE_TIMEOUTS = { planning: 120000, querying_odoo: 180000, designing_report: 420000 };

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

async function postJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error || `HTTP ${r.status}`);
      err.detail = data.detail || data.raw;
      throw err;
    }
    return data;
  } catch (e) {
    if (e && e.name === 'AbortError') {
      const err = new Error('انتهت مهلة هذه المرحلة. يمكنك بدء الطلب من جديد.');
      err.code = 'PHASE_TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function ensureActive(job) {
  if (!job || job.cancelled) {
    const e = new Error('Job cancelled');
    e.code = 'JOB_CANCELLED';
    throw e;
  }
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
    }, PHASE_TIMEOUTS.planning);
    ensureActive(job);
    job.plan = planned.plan;

    job.phase = 'querying_odoo';
    job.updatedAt = Date.now();
    const executed = await postJson(`${base}/api/execute`, { plan: planned.plan }, PHASE_TIMEOUTS.querying_odoo);
    ensureActive(job);

    job.phase = 'designing_report';
    job.updatedAt = Date.now();
    const presented = await postJson(`${base}/api/present`, {
      question: job.question,
      plan: planned.plan,
      results: executed.results,
    }, PHASE_TIMEOUTS.designing_report);
    ensureActive(job);

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
    if (e && e.code === 'JOB_CANCELLED') return;
    job.status = 'failed';
    job.phase = 'failed';
    job.error = {
      message: e && e.message ? e.message : 'Background job failed',
      detail: e && e.detail ? e.detail : undefined,
      code: e && e.code ? e.code : undefined,
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
      cancelled: false,
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

  app.delete('/api/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(204).end();
    job.cancelled = true;
    jobs.delete(req.params.id);
    return res.status(204).end();
  });

  return originalListen.apply(this, args);
};

require('./planner-preload.js');
