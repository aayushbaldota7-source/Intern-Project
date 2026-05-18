/**
 * app.js — OrderPulse Frontend
 *
 * What this file does:
 *  1. Connects to the backend using Socket.IO (WebSocket).
 *  2. Loads all orders from the REST API on page load.
 *  3. Listens for real-time "order:change" events from the server.
 *  4. Updates the event log and orders table whenever something changes.
 *  5. Lets the user create, update, and delete orders.
 */

// ── Config ──────────────────────────────────────────────────
const API = window.location.origin; // same host as the backend
const STATUS_NEXT = { pending: 'shipped', shipped: 'delivered', delivered: 'pending' };

// ── App State ────────────────────────────────────────────────
let orders = [];
let eventCounts = { INSERT: 0, UPDATE: 0, DELETE: 0 };

// ── DOM Elements ─────────────────────────────────────────────
const eventList   = document.getElementById('event-list');
const ordersBody  = document.getElementById('orders-body');
const eventBadge  = document.getElementById('event-count');
const statTotal   = document.getElementById('stat-total');
const statInserts = document.getElementById('stat-inserts');
const statUpdates = document.getElementById('stat-updates');
const statDeletes = document.getElementById('stat-deletes');
const connDot     = document.getElementById('conn-dot');
const connLabel   = document.getElementById('conn-label');
const toastBox    = document.getElementById('toast-container');

// ── WebSocket Connection ─────────────────────────────────────
function connectSocket() {
  const socket = io(API, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    setConnectionStatus('connected');
    toast('Real-time feed connected', 'success');
  });

  socket.on('disconnect', (reason) => {
    setConnectionStatus('disconnected');
    toast(`Disconnected: ${reason}`, 'error');
  });

  socket.on('connect_error', () => {
    setConnectionStatus('disconnected');
  });

  // This event fires whenever a row changes in PostgreSQL
  socket.on('order:change', (payload) => {
    handleChange(payload);
  });
}

function setConnectionStatus(status) {
  connDot.className = 'dot ' + (status === 'connected' ? 'dot-green' : status === 'disconnected' ? 'dot-red' : 'dot-amber');
  connLabel.textContent = status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Connecting…';
}

// ── Handle Real-Time Change ──────────────────────────────────
// Called every time the backend pushes an "order:change" event
function handleChange({ operation, data }) {
  // Update local orders array
  if (operation === 'INSERT') {
    orders.unshift(data);
  } else if (operation === 'UPDATE') {
    const i = orders.findIndex(o => o.id === data.id);
    if (i !== -1) orders[i] = data; else orders.unshift(data);
  } else if (operation === 'DELETE') {
    orders = orders.filter(o => o.id !== data.id);
  }

  // Track counts
  if (eventCounts[operation] !== undefined) eventCounts[operation]++;

  // Re-render everything
  addEventCard(operation, data);
  renderTable();
  updateStats();
}

// ── Event Card ───────────────────────────────────────────────
function addEventCard(operation, data) {
  // Remove empty state placeholder if present
  const empty = eventList.querySelector('.empty-state');
  if (empty) empty.remove();

  const icons = { INSERT: '⬆', UPDATE: '✎', DELETE: '✕' };
  const messages = {
    INSERT: `New order for <strong>${data.customer_name}</strong> — ${data.product_name}`,
    UPDATE: `Order #${data.id} status changed to <strong>${data.status}</strong>`,
    DELETE: `Order #${data.id} (${data.product_name}) was deleted`,
  };

  const card = document.createElement('div');
  card.className = `event-card ${operation}`;
  card.innerHTML = `
    <div class="event-top">
      <span class="event-op ${operation}">${icons[operation]} ${operation}</span>
      <span class="event-time">${new Date().toLocaleTimeString()}</span>
    </div>
    <div class="event-msg">${messages[operation]}</div>
    <div class="event-id">order #${data.id}</div>
  `;

  // Newest events appear at the top
  eventList.insertBefore(card, eventList.firstChild);

  // Keep at most 50 events in the log
  while (eventList.children.length > 50) eventList.removeChild(eventList.lastChild);

  // Update the event count badge
  const total = Object.values(eventCounts).reduce((a, b) => a + b, 0);
  eventBadge.textContent = `${total} events`;
}

// ── Orders Table ─────────────────────────────────────────────
function renderTable() {
  if (orders.length === 0) {
    ordersBody.innerHTML = `<tr><td colspan="6" class="empty-row">No orders yet. Create one using the form.</td></tr>`;
    return;
  }

  ordersBody.innerHTML = orders.map(o => `
    <tr id="row-${o.id}">
      <td class="id-col">#${o.id}</td>
      <td class="name-col">${safe(o.customer_name)}</td>
      <td>${safe(o.product_name)}</td>
      <td><span class="status status-${o.status}">${o.status}</span></td>
      <td>${new Date(o.updated_at).toLocaleString()}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" onclick="nextStatus(${o.id}, '${o.status}')">Next Status</button>
          <button class="row-btn del" onclick="removeOrder(${o.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Flash a row briefly to show it was just updated
function flashRow(id) {
  const row = document.getElementById(`row-${id}`);
  if (row) { row.classList.remove('row-flash'); void row.offsetWidth; row.classList.add('row-flash'); }
}

// ── Stats ────────────────────────────────────────────────────
function updateStats() {
  statTotal.textContent   = orders.length;
  statInserts.textContent = eventCounts.INSERT;
  statUpdates.textContent = eventCounts.UPDATE;
  statDeletes.textContent = eventCounts.DELETE;
}

// ── REST API ─────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Request failed');
  return json;
}

// Load existing orders when the page opens
async function loadOrders() {
  try {
    const { data } = await api('/orders');
    orders = data;
    renderTable();
    updateStats();
  } catch (err) {
    toast(`Could not load orders: ${err.message}`, 'error');
  }
}

// Create a new order (called from the form submit)
async function createOrder(e) {
  e.preventDefault();
  const btn          = document.getElementById('btn-create');
  const customerName = document.getElementById('inp-customer').value.trim();
  const productName  = document.getElementById('inp-product').value.trim();
  const status       = document.getElementById('inp-status').value;

  if (!customerName || !productName) {
    toast('Please fill in all fields', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Creating…`;

  try {
    await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ customer_name: customerName, product_name: productName, status }),
    });
    toast('Order created!', 'success');
    document.getElementById('create-form').reset();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '+ Create Order';
  }
}

// Cycle order status: pending → shipped → delivered → pending
async function nextStatus(id, currentStatus) {
  const newStatus = STATUS_NEXT[currentStatus] || 'pending';
  try {
    await api(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    flashRow(id);
    toast(`Order #${id} → ${newStatus}`, 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Delete an order
async function removeOrder(id) {
  if (!confirm(`Delete order #${id}?`)) return;
  try {
    await api(`/orders/${id}`, { method: 'DELETE' });
    toast(`Order #${id} deleted`, 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Clear Event Log ───────────────────────────────────────────
function clearEvents() {
  eventList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📡</div>
      <p>Waiting for database changes…</p>
      <small>Create an order using the form to see real-time events</small>
    </div>`;
  eventCounts = { INSERT: 0, UPDATE: 0, DELETE: 0 };
  eventBadge.textContent = '0 events';
  updateStats();
}

// ── Toast Notification ────────────────────────────────────────
function toast(message, type = 'info', ms = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ── HTML Escape (prevents XSS) ───────────────────────────────
function safe(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Expose functions used in HTML onclick attributes
window.nextStatus  = nextStatus;
window.removeOrder = removeOrder;
window.clearEvents = clearEvents;

// ── Start the App ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('create-form').addEventListener('submit', createOrder);
  connectSocket();   // Connect WebSocket
  loadOrders();      // Fetch existing orders from REST API
  setConnectionStatus('connecting');
});
