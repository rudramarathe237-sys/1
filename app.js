const API_BASE = "http://localhost:4000/api";

// Token is kept in memory only for this session (not localStorage).
// Refreshing the page will require signing in again.
let state = {
  token: null,
  email: null,
  products: [],
  activeProductId: null,
};

// ---------- DOM refs ----------
const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const sessionEmail = document.getElementById("sessionEmail");
const logoutBtn = document.getElementById("logoutBtn");
const statusDot = document.getElementById("statusDot");

const tabs = document.querySelectorAll(".tab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");

const addProductForm = document.getElementById("addProductForm");
const addProductError = document.getElementById("addProductError");
const productList = document.getElementById("productList");
const emptyState = document.getElementById("emptyState");
const itemCount = document.getElementById("itemCount");

const priceModal = document.getElementById("priceModal");
const priceModalItemName = document.getElementById("priceModalItemName");
const priceForm = document.getElementById("priceForm");
const priceModalError = document.getElementById("priceModalError");
const priceModalCancel = document.getElementById("priceModalCancel");
const historyList = document.getElementById("historyList");

// ---------- API helper ----------
async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// ---------- View toggling ----------
function showDashboard() {
  authView.hidden = true;
  dashboardView.hidden = false;
  sessionEmail.textContent = state.email || "";
  logoutBtn.hidden = false;
}

function showAuth() {
  authView.hidden = false;
  dashboardView.hidden = true;
  sessionEmail.textContent = "";
  logoutBtn.hidden = true;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    loginError.textContent = "";
    registerError.textContent = "";
  });
});

// ---------- Auth ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const formData = new FormData(loginForm);
  try {
    const data = await api("/auth/login", {
      method: "POST",
      auth: false,
      body: {
        email: formData.get("email"),
        password: formData.get("password"),
      },
    });
    onAuthenticated(data);
  } catch (err) {
    loginError.textContent = err.message;
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerError.textContent = "";
  const formData = new FormData(registerForm);
  try {
    const data = await api("/auth/register", {
      method: "POST",
      auth: false,
      body: {
        email: formData.get("email"),
        password: formData.get("password"),
      },
    });
    onAuthenticated(data);
  } catch (err) {
    registerError.textContent = err.message;
  }
});

function onAuthenticated(data) {
  state.token = data.token;
  state.email = data.user.email;
  loginForm.reset();
  registerForm.reset();
  showDashboard();
  loadProducts();
}

logoutBtn.addEventListener("click", () => {
  state.token = null;
  state.email = null;
  state.products = [];
  showAuth();
});

// ---------- Products: list & render ----------
async function loadProducts() {
  try {
    const data = await api("/products");
    state.products = data.products;
    renderProducts();
  } catch (err) {
    if (err.message.includes("Invalid or expired token")) {
      logoutBtn.click();
    }
  }
}

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

function formatDate(iso) {
  const d = new Date(iso + "Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function renderProducts() {
  itemCount.textContent = state.products.length;
  emptyState.hidden = state.products.length !== 0;
  productList.innerHTML = "";

  state.products.forEach((p) => {
    const li = document.createElement("li");
    li.className = `product-row ${p.isAtOrBelowTarget ? "status-hit" : "status-watch"}`;
    li.innerHTML = `
      <span class="row-status"></span>
      <div class="row-main">
        <div class="row-name">${escapeHtml(p.name)}</div>
        ${p.url ? `<a class="row-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.url)}</a>` : ""}
      </div>
      <div class="row-prices">
        <div class="current">${formatMoney(p.currentPrice)}</div>
        <div class="target">target ${formatMoney(p.targetPrice)}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-action="log" data-id="${p.id}">Log price</button>
        <button class="icon-btn danger" data-action="delete" data-id="${p.id}">Remove</button>
      </div>
    `;
    productList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Add product ----------
addProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addProductError.textContent = "";
  const formData = new FormData(addProductForm);

  try {
    await api("/products", {
      method: "POST",
      body: {
        name: formData.get("name"),
        url: formData.get("url") || null,
        currentPrice: parseFloat(formData.get("currentPrice")),
        targetPrice: parseFloat(formData.get("targetPrice")),
      },
    });
    addProductForm.reset();
    loadProducts();
  } catch (err) {
    addProductError.textContent = err.message;
  }
});

// ---------- Row actions (delegated) ----------
productList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === "delete") {
    if (!confirm("Stop tracking this item?")) return;
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  }

  if (btn.dataset.action === "log") {
    openPriceModal(id);
  }
});

// ---------- Price modal ----------
async function openPriceModal(productId) {
  state.activeProductId = productId;
  priceModalError.textContent = "";
  priceForm.reset();

  const product = state.products.find((p) => String(p.id) === String(productId));
  priceModalItemName.textContent = product ? product.name : "";

  priceModal.hidden = false;
  await refreshHistory(productId);
}

async function refreshHistory(productId) {
  try {
    const data = await api(`/products/${productId}/prices`);
    historyList.innerHTML = "";
    [...data.history].reverse().forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${formatMoney(entry.price)}</span><span>${formatDate(entry.checked_at)}</span>`;
      historyList.appendChild(li);
    });
  } catch (err) {
    historyList.innerHTML = "";
  }
}

priceModalCancel.addEventListener("click", () => {
  priceModal.hidden = true;
});

priceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  priceModalError.textContent = "";
  const formData = new FormData(priceForm);

  try {
    await api(`/products/${state.activeProductId}/prices`, {
      method: "POST",
      body: { price: parseFloat(formData.get("price")) },
    });
    priceForm.reset();
    await refreshHistory(state.activeProductId);
    await loadProducts();
  } catch (err) {
    priceModalError.textContent = err.message;
  }
});

// ---------- Init ----------
showAuth();
