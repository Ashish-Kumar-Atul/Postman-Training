const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const SEED = [
  { name: 'Wireless Mouse', price: 799, category: 'Electronics', inStock: true, description: 'Ergonomic 2.4GHz mouse' },
  { name: 'Mechanical Keyboard', price: 3499, category: 'Electronics', inStock: true, description: 'Blue switches, RGB backlight' },
  { name: 'Notebook A5', price: 120, category: 'Stationery', inStock: true, description: '200 ruled pages' },
  { name: 'Coffee Mug', price: 299, category: 'Kitchen', inStock: false, description: 'Ceramic, 350ml' },
  { name: 'Desk Lamp', price: 1299, category: 'Home', inStock: true, description: 'LED with 3 brightness levels' },
];

// ---------- tiny JSON-file "database" ----------
function seedDb() {
  const now = new Date().toISOString();
  const products = SEED.map((p, i) => ({ id: i + 1, ...p, createdAt: now, updatedAt: now }));
  const db = { nextId: products.length + 1, products };
  saveDb(db);
  return db;
}
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return seedDb();
  }
}
function saveDb(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let db = loadDb();

// ---------- validation ----------
const FIELDS = ['name', 'price', 'category', 'inStock', 'description'];

function validate(body, { partial }) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object'];
  }
  const unknown = Object.keys(body).filter((k) => !FIELDS.includes(k) && !['id', 'createdAt', 'updatedAt'].includes(k));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  const need = (f) => !partial || body[f] !== undefined;
  if (need('name') && (typeof body.name !== 'string' || !body.name.trim())) errors.push('"name" is required and must be a non-empty string');
  if (need('price') && (typeof body.price !== 'number' || body.price < 0)) errors.push('"price" is required and must be a number >= 0');
  if (need('category') && (typeof body.category !== 'string' || !body.category.trim())) errors.push('"category" is required and must be a non-empty string');
  if (body.inStock !== undefined && typeof body.inStock !== 'boolean') errors.push('"inStock" must be true or false');
  if (body.description !== undefined && typeof body.description !== 'string') errors.push('"description" must be a string');
  if (partial && !FIELDS.some((f) => body[f] !== undefined)) errors.push(`PATCH body must contain at least one of: ${FIELDS.join(', ')}`);
  return errors;
}
function pick(body) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
  return out;
}
// full product with defaults, fields in a consistent order
function build(id, body, createdAt) {
  const p = pick(body);
  return {
    id,
    name: p.name,
    price: p.price,
    category: p.category,
    inStock: p.inStock ?? true,
    description: p.description ?? '',
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}
function findIndex(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Bad Request', message: 'id must be a positive integer' });
    return -1;
  }
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx === -1) res.status(404).json({ error: 'Not Found', message: `Product with id ${id} not found` });
  return idx;
}

// ---------- middleware ----------
// CORS: lets the client (running on a different port) call this API from the browser
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use((err, req, res, next) => {
  // malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Bad Request', message: 'Malformed JSON in request body' });
  }
  next(err);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) console.log(`${new Date().toLocaleTimeString()}  ${req.method} ${req.originalUrl}`);
  next();
});
// ---------- routes ----------
app.get('/', (req, res) => {
  res.json({ message: 'Products API is running', endpoints: '/api/products', health: '/api/health' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), totalProducts: db.products.length });
});

// READ all  (supports ?search=, ?category=, ?inStock=, ?sort=, ?order=, ?page=, ?limit=)
app.get('/api/products', (req, res) => {
  let list = [...db.products];
  const { search, category, inStock, sort = 'id', order = 'asc' } = req.query;

  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }
  if (category) list = list.filter((p) => p.category.toLowerCase() === String(category).toLowerCase());
  if (inStock !== undefined) list = list.filter((p) => p.inStock === (inStock === 'true'));

  if (['id', 'name', 'price', 'category', 'createdAt'].includes(sort)) {
    list.sort((a, b) => (a[sort] > b[sort] ? 1 : a[sort] < b[sort] ? -1 : 0));
    if (order === 'desc') list.reverse();
  }

  const total = list.length;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 100));
  const page = Math.max(1, Number(req.query.page) || 1);
  const data = list.slice((page - 1) * limit, page * limit);

  res.json({ total, page, limit, count: data.length, data });
});

// READ one
app.get('/api/products/:id', (req, res) => {
  const idx = findIndex(req, res);
  if (idx === -1) return;
  res.json(db.products[idx]);
});

// CREATE
app.post('/api/products', (req, res) => {
  const errors = validate(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });

  const product = build(db.nextId++, req.body, new Date().toISOString());
  product.updatedAt = product.createdAt;
  db.products.push(product);
  saveDb(db);
  res.status(201).location(`/api/products/${product.id}`).json(product);
});

// UPDATE (full replace)
app.put('/api/products/:id', (req, res) => {
  const idx = findIndex(req, res);
  if (idx === -1) return;
  const errors = validate(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });

  const old = db.products[idx];
  db.products[idx] = build(old.id, req.body, old.createdAt);
  saveDb(db);
  res.json(db.products[idx]);
});

// UPDATE (partial)
app.patch('/api/products/:id', (req, res) => {
  const idx = findIndex(req, res);
  if (idx === -1) return;
  const errors = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'Validation Failed', details: errors });

  db.products[idx] = { ...db.products[idx], ...pick(req.body), updatedAt: new Date().toISOString() };
  saveDb(db);
  res.json(db.products[idx]);
});

// DELETE
app.delete('/api/products/:id', (req, res) => {
  const idx = findIndex(req, res);
  if (idx === -1) return;
  const [removed] = db.products.splice(idx, 1);
  saveDb(db);
  res.json({ message: `Product ${removed.id} deleted`, deleted: removed });
});

// Reset data back to the original sample products (handy between training sessions)
app.post('/api/reset', (req, res) => {
  db = seedDb();
  res.json({ message: 'Database reset to sample data', total: db.products.length });
});

// unknown API route
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Cannot ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`\n  [server] API running at http://localhost:${PORT}/api/products\n`);
});
