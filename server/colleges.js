const express = require('express');
const SEED = require('./colleges-seed.json');

const KEYS = Object.keys(SEED);
const REQUIRED = ['name', 'code'];
const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

// full college record: every key from the seed, defaults filled in, server-managed fields on top
function build(id, body, createdAt) {
  const out = { id };
  for (const k of KEYS) out[k] = body[k] !== undefined ? body[k] : defaultFor(SEED[k]);
  return { ...out, createdAt, updatedAt: new Date().toISOString() };
}
function defaultFor(v) {
  switch (kind(v)) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, defaultFor(x)]));
    default: return null;
  }
}

function validate(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['Request body must be a JSON object'];
  const errors = [];
  const unknown = Object.keys(body).filter((k) => !KEYS.includes(k) && !['id', 'createdAt', 'updatedAt'].includes(k));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);
  for (const k of REQUIRED) {
    if (!partial || body[k] !== undefined) {
      if (typeof body[k] !== 'string' || !body[k].trim()) errors.push(`"${k}" is required and must be a non-empty string`);
    }
  }
  for (const k of KEYS) {
    const want = kind(SEED[k]);
    if (body[k] === undefined || want === 'null') continue; // fields seeded as null accept any value
    const got = kind(body[k]);
    if (got !== want && !(got === 'null' && want !== 'object')) errors.push(`"${k}" must be of type ${want}`);
  }
  if (partial && !KEYS.some((k) => body[k] !== undefined)) errors.push('PATCH body must contain at least one known field');
  return errors;
}

module.exports = function collegesRouter(getDb, saveDb) {
  const r = express.Router();

  // make sure the collection exists (older db.json files only have products)
  const ensure = () => {
    const db = getDb();
    if (!db.colleges) {
      const now = new Date().toISOString();
      db.colleges = [build(1, SEED, now)];
      db.nextCollegeId = 2;
      saveDb(db);
    }
    return db;
  };
  const dupCode = (db, code, exceptId) => db.colleges.some((c) => c.id !== exceptId && c.code.toLowerCase() === code.trim().toLowerCase());
  const clean = (b) => ({ ...b, name: b.name?.trim?.() ?? b.name, code: b.code?.trim?.() ?? b.code });
  const locate = (req, res, db) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: 'Bad Request', message: 'id must be a positive integer' }); return -1; }
    const idx = db.colleges.findIndex((c) => c.id === id);
    if (idx === -1) res.status(404).json({ error: 'Not Found', message: `College with id ${id} not found` });
    return idx;
  };

  // GET all (?search=, ?state=, ?city=, ?type=, ?page=, ?limit=)
  r.get('/', (req, res) => {
    const db = ensure();
    let list = [...db.colleges];
    const { search, state, city, type } = req.query;
    if (search) { const q = String(search).toLowerCase(); list = list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)); }
    if (state) list = list.filter((c) => (c.state || '').toLowerCase() === String(state).toLowerCase());
    if (city) list = list.filter((c) => (c.city || '').toLowerCase() === String(city).toLowerCase());
    if (type) list = list.filter((c) => (c.type || '').toLowerCase() === String(type).toLowerCase());
    const total = list.length;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 100));
    const page = Math.max(1, Number(req.query.page) || 1);
    const data = list.slice((page - 1) * limit, page * limit);
    res.json({ total, page, limit, count: data.length, data });
  });

  // GET one
  r.get('/:id', (req, res) => {
    const db = ensure();
    const idx = locate(req, res, db);
    if (idx !== -1) res.json(db.colleges[idx]);
  });

  // POST create
  r.post('/', (req, res) => {
    const db = ensure();
    const errors = validate(req.body, { partial: false });
    if (!errors.length && dupCode(db, req.body.code)) errors.push(`A college with code "${req.body.code.trim()}" already exists`);
    if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });
    const now = new Date().toISOString();
    const college = build(db.nextCollegeId++, clean(req.body), now);
    college.updatedAt = now;
    db.colleges.push(college);
    saveDb(db);
    res.status(201).location(`/api/colleges/${college.id}`).json(college);
  });

  // PUT replace ALL colleges with the array in the body
  r.put('/', (req, res) => {
    const db = ensure();
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Validation Failed', details: ['Request body must be a JSON array of colleges'] });
    const errors = [];
    const seen = new Set();
    req.body.forEach((item, i) => {
      validate(item, { partial: false }).forEach((e) => errors.push(`[${i}] ${e}`));
      const code = typeof item?.code === 'string' ? item.code.trim().toLowerCase() : null;
      if (code) { if (seen.has(code)) errors.push(`[${i}] duplicate code "${item.code.trim()}"`); seen.add(code); }
    });
    if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });
    const now = new Date().toISOString();
    db.colleges = req.body.map((item, i) => build(i + 1, clean(item), now));
    db.nextCollegeId = db.colleges.length + 1;
    saveDb(db);
    res.json({ message: `Replaced all colleges (${db.colleges.length} total)`, total: db.colleges.length, data: db.colleges });
  });

  // PUT replace one
  r.put('/:id', (req, res) => {
    const db = ensure();
    const idx = locate(req, res, db);
    if (idx === -1) return;
    const errors = validate(req.body, { partial: false });
    if (!errors.length && dupCode(db, req.body.code, db.colleges[idx].id)) errors.push(`A college with code "${req.body.code.trim()}" already exists`);
    if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });
    const old = db.colleges[idx];
    db.colleges[idx] = build(old.id, clean(req.body), old.createdAt);
    saveDb(db);
    res.json(db.colleges[idx]);
  });

  // PUT / PATCH a college's courses or fees
  //   PUT   /:id/courses | /:id/fees  -> body is an array; replaces the whole list
  //   PATCH /:id/courses | /:id/fees  -> body is an object (or array of objects) with the item key
  //                                      ("code" for courses, "courseCode" for fees); merges into the
  //                                      matching item, or adds it if it does not exist yet
  const SUB = { courses: 'code', fees: 'courseCode' };
  for (const [field, key] of Object.entries(SUB)) {
    const itemErrors = (items) => {
      const errs = [];
      items.forEach((it, i) => {
        if (!it || typeof it !== 'object' || Array.isArray(it)) errs.push(`[${i}] must be an object`);
        else if (typeof it[key] !== 'string' || !it[key].trim()) errs.push(`[${i}] "${key}" is required and must be a non-empty string`);
      });
      return errs;
    };
    r.put(`/:id/${field}`, (req, res) => {
      const db = ensure();
      const idx = locate(req, res, db);
      if (idx === -1) return;
      if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Validation Failed', details: [`Request body must be a JSON array of ${field}`] });
      const errors = itemErrors(req.body);
      if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });
      db.colleges[idx] = { ...db.colleges[idx], [field]: req.body, updatedAt: new Date().toISOString() };
      saveDb(db);
      res.json(db.colleges[idx]);
    });
    r.patch(`/:id/${field}`, (req, res) => {
      const db = ensure();
      const idx = locate(req, res, db);
      if (idx === -1) return;
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const errors = itemErrors(items);
      if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });
      const list = [...(db.colleges[idx][field] || [])];
      for (const it of items) {
        const at = list.findIndex((x) => x[key] === it[key]);
        if (at === -1) list.push(it); else list[at] = { ...list[at], ...it };
      }
      db.colleges[idx] = { ...db.colleges[idx], [field]: list, updatedAt: new Date().toISOString() };
      saveDb(db);
      res.json(db.colleges[idx]);
    });
  }

  // DELETE one
  r.delete('/:id', (req, res) => {
    const db = ensure();
    const idx = locate(req, res, db);
    if (idx === -1) return;
    const [removed] = db.colleges.splice(idx, 1);
    saveDb(db);
    res.json({ message: `College ${removed.id} deleted`, deleted: removed });
  });

  // reset to the NIET sample record
  r.post('/reset', (req, res) => {
    const db = getDb();
    delete db.colleges;
    ensure();
    res.json({ message: 'Colleges reset to sample data', total: getDb().colleges.length });
  });

  return r;
};
