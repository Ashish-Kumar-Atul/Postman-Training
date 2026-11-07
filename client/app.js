const BASE = window.API_BASE || 'http://localhost:5050';
const API = BASE + '/api/products';
const $ = (id) => document.getElementById(id);
const state = { products: [], editingId: null };

// ---------- API helper that logs every request ----------
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new Error(`Cannot reach the API at ${BASE}. Is the server running?`);
  }
  const data = await res.json().catch(() => null);
  logRequest(method, url, body, res.status, data);
  if (!res.ok) {
    const msg = data?.details?.join('; ') || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function logRequest(method, url, body, status, response) {
  const li = document.createElement('li');
  const full = url;
  li.innerHTML = `
    <div class="line">
      <span class="pill ${method.toLowerCase()}">${method}</span>
      <span>${escapeHtml(full)}</span>
      <span class="status ${status < 400 ? 'ok' : 'err'}">${status}</span>
    </div>
    ${body !== undefined ? `<pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>` : ''}
    <details><summary>Response</summary><pre>${escapeHtml(JSON.stringify(response, null, 2))}</pre></details>`;
  $('log').prepend(li);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = ''), 2500);
}

// ---------- READ ----------
async function loadProducts() {
  const params = new URLSearchParams();
  if ($('search').value.trim()) params.set('search', $('search').value.trim());
  if ($('filterCategory').value) params.set('category', $('filterCategory').value);
  const qs = params.toString();
  try {
    const res = await api('GET', API + (qs ? `?${qs}` : ''));
    state.products = res.data;
    render(res.total);
  } catch (e) {
    toast(e.message, true);
  }
}

async function refreshCategories() {
  // categories come from an unfiltered list (not logged, to keep the log readable)
  const res = await fetch(API).then((r) => r.json()).catch(() => ({ data: [] }));
  const cats = [...new Set(res.data.map((p) => p.category))].sort();
  const sel = $('filterCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
  sel.value = cats.includes(current) ? current : '';
  $('categories').innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join('');
}

function render(total) {
  $('count').textContent = `(${total})`;
  $('empty').hidden = state.products.length > 0;
  $('rows').innerHTML = state.products
    .map(
      (p) => `
    <tr class="${p.id === state.editingId ? 'editing' : ''}">
      <td>${p.id}</td>
      <td class="name">${escapeHtml(p.name)}${p.description ? `<small>${escapeHtml(p.description)}</small>` : ''}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>₹${Number(p.price).toLocaleString('en-IN')}</td>
      <td><button class="stock ${p.inStock ? 'yes' : 'no'}" data-toggle="${p.id}" title="PATCH — toggle stock">${p.inStock ? 'In stock' : 'Out of stock'}</button></td>
      <td><div class="row-actions">
        <button class="ghost small" data-edit="${p.id}" title="PUT — replace product">Edit</button>
        <button class="danger small" data-delete="${p.id}" title="DELETE product">Delete</button>
      </div></td>
    </tr>`
    )
    .join('');
}

// ---------- CREATE / UPDATE (PUT) ----------
function formData() {
  return {
    name: $('name').value.trim(),
    price: Number($('price').value),
    category: $('category').value.trim(),
    inStock: $('inStock').checked,
    description: $('description').value.trim(),
  };
}

$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (state.editingId) {
      await api('PUT', `${API}/${state.editingId}`, formData());
      toast('Product updated');
    } else {
      const p = await api('POST', API, formData());
      toast(`Product #${p.id} created`);
    }
    resetForm();
    await refreshCategories();
    await loadProducts();
  } catch (err) {
    toast(err.message, true);
  }
});

async function startEdit(id) {
  try {
    const p = await api('GET', `${API}/${id}`);
    state.editingId = p.id;
    $('productId').value = p.id;
    $('name').value = p.name;
    $('price').value = p.price;
    $('category').value = p.category;
    $('inStock').checked = p.inStock;
    $('description').value = p.description || '';
    $('formTitle').innerHTML = `Edit product #${p.id} <span class="pill put">PUT</span>`;
    $('submitBtn').textContent = 'Save changes';
    $('cancelBtn').hidden = false;
    render(state.products.length);
    $('name').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    toast(err.message, true);
  }
}

function resetForm() {
  state.editingId = null;
  $('productForm').reset();
  $('inStock').checked = true;
  $('formTitle').innerHTML = 'Add product <span class="pill post">POST</span>';
  $('submitBtn').textContent = 'Create product';
  $('cancelBtn').hidden = true;
}

// ---------- table actions: PATCH / DELETE ----------
$('rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  try {
    if (btn.dataset.edit) return startEdit(Number(btn.dataset.edit));

    if (btn.dataset.toggle) {
      const p = state.products.find((x) => x.id === Number(btn.dataset.toggle));
      await api('PATCH', `${API}/${p.id}`, { inStock: !p.inStock });
      toast(`Stock updated for "${p.name}"`);
    }

    if (btn.dataset.delete) {
      const p = state.products.find((x) => x.id === Number(btn.dataset.delete));
      if (!confirm(`Delete "${p.name}"?`)) return;
      await api('DELETE', `${API}/${p.id}`);
      toast(`Deleted "${p.name}"`);
      if (state.editingId === p.id) resetForm();
      await refreshCategories();
    }
    await loadProducts();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- misc ----------
$('cancelBtn').addEventListener('click', () => { resetForm(); render(state.products.length); });
$('clearLog').addEventListener('click', () => ($('log').innerHTML = ''));
$('filterCategory').addEventListener('change', loadProducts);
let searchTimer;
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadProducts, 300); });

$('resetBtn').addEventListener('click', async () => {
  if (!confirm('Reset all products back to the sample data?')) return;
  try {
    await api('POST', BASE + '/api/reset');
    resetForm();
    await refreshCategories();
    await loadProducts();
    toast('Sample data restored');
  } catch (err) {
    toast(err.message, true);
  }
});

// Sync when data is changed from Postman in another window
window.addEventListener('focus', () => { refreshCategories(); loadProducts(); });

refreshCategories().then(loadProducts);
