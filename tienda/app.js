// ============================================
// El Palma Inc. — Tienda Clientes
// Lógica Principal — Infinite Scroll
// ============================================

// ==================== FIREBASE ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, startAfter }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics"
const firebaseConfig = {
  apiKey: "AIzaSyCRJ_l7BXJtwVDGc-KbBkLuSgMCBDtGY4M",
  authDomain: "tienda-de-ropa-2b4f6.firebaseapp.com",
  projectId: "tienda-de-ropa-2b4f6",
  storageBucket: "tienda-de-ropa-2b4f6.firebasestorage.app",
  messagingSenderId: "779208963776",
  appId: "1:779208963776:web:c6a07bd957f0a359235f25",
  measurementId: "G-WRXQD1D7TK"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ==================== STATE ====================
window._allProducts = [];
let filteredProducts  = [];
let activeCat         = 'all';
let cart              = [];
let currentProduct    = null;
let selectedTalla     = null;
let selectedColor     = null;
let deliveryType      = null;

// Paginación
let lastDoc    = null;   // último documento cargado en Firestore
let isLoading  = false;  // evita cargas simultáneas
let allLoaded  = false;  // ya no hay más productos en Firebase

const PAGE_FIRST = 15;   // productos al abrir la página
const PAGE_MORE  = 10;   // productos por cada scroll al fondo

const WA_NUMBER = '56954998792';

// ==================== CARGA DESDE FIREBASE ====================
async function loadProducts(pageSize) {
  if (isLoading || allLoaded) return;
  isLoading = true;
  showLoadingBar(true);

  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(db, "productos"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, "productos"),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
    }

    const snap = await getDocs(q);

    // Si devuelve menos productos que los pedidos, ya no hay más
    if (snap.empty || snap.docs.length < pageSize) {
      allLoaded = true;
      removeSentinel();
      updateEndMessage();
    }

    if (!snap.empty) {
      lastDoc = snap.docs[snap.docs.length - 1];
      const nuevos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window._allProducts = [...window._allProducts, ...nuevos];
      updateCounts();
      applyFilters();
    }

    // Limpiar mensaje inicial de carga si es la primera vez
    const statusEl = document.getElementById('gridStatus');
    if (statusEl && window._allProducts.length > 0) statusEl.remove();

  } catch (err) {
    console.error("Firebase error:", err);
    const statusEl = document.getElementById('gridStatus');
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#f66">Error al conectar con Firebase.<br>
        <small>Verifica tus credenciales en app.js</small></span>`;
    }
  } finally {
    isLoading = false;
    showLoadingBar(false);
  }
}

// ==================== BARRA DE CARGA ====================
function showLoadingBar(show) {
  let bar = document.getElementById('loadingBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'loadingBar';
    bar.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: 100%; height: 3px;
      background: linear-gradient(90deg, var(--accent, #6cf), transparent);
      z-index: 9999; transition: opacity .3s;
      animation: loadSlide 1.2s ease-in-out infinite;
    `;
    // Agregar animación al head
    if (!document.getElementById('loadBarStyle')) {
      const style = document.createElement('style');
      style.id = 'loadBarStyle';
      style.textContent = `
        @keyframes loadSlide {
          0%   { transform: translateX(-100%); opacity:1 }
          100% { transform: translateX(100%);  opacity:0 }
        }
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(bar);
  }
  bar.style.display = show ? 'block' : 'none';
}

// ==================== INFINITE SCROLL ====================
let scrollObserver = null;

function setupScrollObserver() {
  // Desconectar si ya existe
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !isLoading && !allLoaded) {
        loadProducts(PAGE_MORE);
      }
    },
    { rootMargin: '300px' } // empieza a cargar 300px antes del final
  );

  const sentinel = getSentinel();
  if (sentinel) scrollObserver.observe(sentinel);
}

function getSentinel() {
  let s = document.getElementById('scrollSentinel');
  if (!s) {
    s = document.createElement('div');
    s.id = 'scrollSentinel';
    s.style.cssText = 'height:1px;width:100%;pointer-events:none;';
    // Insertar justo después del productGrid
    const grid = document.getElementById('productGrid');
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(s, grid.nextSibling);
    }
  }
  return s;
}

function removeSentinel() {
  const s = document.getElementById('scrollSentinel');
  if (s) s.remove();
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }
}

function updateEndMessage() {
  let msg = document.getElementById('endMessage');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'endMessage';
    msg.style.cssText = `
      text-align:center; padding: 24px 0 12px;
      color: var(--text3, #888); font-size: 12px;
      letter-spacing: 2px; font-family: monospace;
    `;
    const grid = document.getElementById('productGrid');
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(msg, grid.nextSibling);
    }
  }
  msg.textContent = window._allProducts.length
    ? `— ${window._allProducts.length} productos cargados —`
    : '';
}

// ==================== RENDER ====================
window._renderProducts = function() {
  updateCounts();
  applyFilters();
};

function updateCounts() {
  const all = window._allProducts;
  const allEl = document.getElementById('cnt-all');
  if (allEl) allEl.textContent = all.length;

  ['1','2','3','4','5'].forEach(n => {
    const el = document.getElementById('cnt-' + n);
    if (el) el.textContent = all.filter(p => p.categoria === 'categoria-' + n).length;
  });
}

function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const priceMin    = document.getElementById('priceMin');
  const priceMax    = document.getElementById('priceMax');

  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const minP   = priceMin ? (parseFloat(priceMin.value) || 0) : 0;
  const maxP   = priceMax ? (parseFloat(priceMax.value) || Infinity) : Infinity;

  filteredProducts = window._allProducts.filter(p => {
    const matchCat    = activeCat === 'all' || p.categoria === activeCat;
    const matchSearch = !search ||
      (p.nombre && p.nombre.toLowerCase().includes(search)) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(search));
    const price       = p.precioOferta || p.precio;
    const matchPrice  = price >= minP && price <= maxP;
    return matchCat && matchSearch && matchPrice;
  });

  renderGrid();
}

function renderGrid() {
  const grid    = document.getElementById('productGrid');
  const countEl = document.getElementById('gridCount');

  if (countEl) {
    countEl.innerHTML = `<span>${filteredProducts.length}</span> productos`;
  }
  if (!grid) return;

  if (!filteredProducts.length && window._allProducts.length > 0) {
    grid.innerHTML = `<div id="gridStatus">No se encontraron productos con esos filtros.</div>`;
    return;
  }

  grid.innerHTML = filteredProducts.map((p) => {
    const hasOffer = p.precioOferta && p.precioOferta < p.precio;
    return `
      <div class="product-card" onclick="openProduct('${p.id}')">
        <div class="card-img-wrap">
          ${p.imagen
            ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">`
            : '<div style="width:100%;height:100%;background:var(--bg2)"></div>'}
          ${hasOffer ? '<div class="oferta-badge">OFERTA</div>' : ''}
        </div>
        <div class="card-body">
          <div class="card-name">${p.nombre}</div>
          <div class="card-prices">
            ${hasOffer
              ? `<span class="card-price-offer">${fmt(p.precioOferta)}</span>
                 <span class="card-price-orig">${fmt(p.precio)}</span>`
              : `<span class="card-price-normal">${fmt(p.precio)}</span>`}
          </div>
          <div class="card-cat">${(p.categoria || '').replace('-', ' ')}</div>
        </div>
      </div>
    `;
  }).join('');
}

function fmt(n) {
  return '$' + Number(n).toLocaleString('es-CL');
}

// ==================== FILTROS ====================
function setCat(cat, btn) {
  activeCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function resetFilters() {
  activeCat = 'all';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  const allBtn = document.querySelector('[data-cat="all"]');
  if (allBtn) allBtn.classList.add('active');

  const searchInput = document.getElementById('searchInput');
  const priceMin    = document.getElementById('priceMin');
  const priceMax    = document.getElementById('priceMax');

  if (searchInput) searchInput.value = '';
  if (priceMin)    priceMin.value    = '';
  if (priceMax)    priceMax.value    = '';

  applyFilters();
}

// Event listeners para filtros
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const priceMin    = document.getElementById('priceMin');
  const priceMax    = document.getElementById('priceMax');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (priceMin)    priceMin.addEventListener('input', applyFilters);
  if (priceMax)    priceMax.addEventListener('input', applyFilters);

  // Configurar sentinel y cargar primeros 15 productos
  setupScrollObserver();
  loadProducts(PAGE_FIRST);
});

// ==================== MODAL DE PRODUCTO ====================
function openProduct(id) {
  const p = window._allProducts.find(x => x.id === id);
  if (!p) return;
  currentProduct = p;
  selectedTalla  = null;
  selectedColor  = null;

  const hasOffer = p.precioOferta && p.precioOferta < p.precio;

  const pmImg    = document.getElementById('pmImg');
  const pmCat    = document.getElementById('pmCat');
  const pmName   = document.getElementById('pmName');
  const pmBadge  = document.getElementById('pmBadge');
  const pmDesc   = document.getElementById('pmDesc');
  const pmPrices = document.getElementById('pmPrices');

  if (pmImg)    pmImg.src          = p.imagen || '';
  if (pmCat)    pmCat.textContent  = (p.categoria || '').replace('-', ' ').toUpperCase();
  if (pmName)   pmName.textContent = p.nombre;
  if (pmBadge)  pmBadge.style.display = hasOffer ? 'block' : 'none';
  if (pmDesc)   pmDesc.textContent = p.descripcion || '';
  if (pmPrices) {
    pmPrices.innerHTML = hasOffer
      ? `<span class="pm-price-offer">${fmt(p.precioOferta)}</span>
         <span class="pm-price-orig">${fmt(p.precio)}</span>`
      : `<span class="pm-price-normal">${fmt(p.precio)}</span>`;
  }

  // Tallas
  const tallasDiv  = document.getElementById('pmTallas');
  const tallasWrap = document.getElementById('pmTallasWrap');
  const tallas     = Array.isArray(p.tallas) ? p.tallas : [];
  if (tallasWrap) tallasWrap.style.display = tallas.length ? '' : 'none';
  if (tallasDiv) {
    tallasDiv.innerHTML = tallas.map(t =>
      `<div class="chip" onclick="selectChip(this,'talla','${t}')">${t}</div>`
    ).join('');
  }

  // Colores
  const coloresDiv  = document.getElementById('pmColores');
  const coloresWrap = document.getElementById('pmColoresWrap');
  const colores     = Array.isArray(p.colores) ? p.colores : [];
  if (coloresWrap) coloresWrap.style.display = colores.length ? '' : 'none';
  if (coloresDiv) {
    coloresDiv.innerHTML = colores.map(c =>
      `<div class="chip" onclick="selectChip(this,'color','${c}')">${c}</div>`
    ).join('');
  }

  openModal('productModal');
}

function selectChip(el, type, val) {
  const parent = el.parentElement;
  parent.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  if (type === 'talla') selectedTalla = val;
  else selectedColor = val;
}

function addToCart() {
  if (!currentProduct) return;
  const tallas  = Array.isArray(currentProduct.tallas)  ? currentProduct.tallas  : [];
  const colores = Array.isArray(currentProduct.colores) ? currentProduct.colores : [];

  if (tallas.length  && !selectedTalla)  { showToast('Selecciona una talla', 'error');  return; }
  if (colores.length && !selectedColor)  { showToast('Selecciona un color', 'error');   return; }

  cart.push({
    id: Date.now(),
    producto: currentProduct,
    talla:    selectedTalla,
    color:    selectedColor,
    precio:   currentProduct.precioOferta && currentProduct.precioOferta < currentProduct.precio
              ? currentProduct.precioOferta : currentProduct.precio
  });

  updateCartCount();
  closeModal('productModal');
  showToast('Añadido al carrito', 'success');
}

// ==================== CARRITO ====================
function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (el) {
    el.textContent = cart.length;
    el.classList.toggle('show', cart.length > 0);
  }
}

function openCart() {
  renderCart();
  openModal('cartModal');
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const total     = cart.reduce((s, i) => s + i.precio, 0);
  const cartTotal = document.getElementById('cartTotal');
  if (cartTotal) cartTotal.textContent = fmt(total);
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = `<div class="cart-empty"><div class="empty-icon">🛒</div>Tu carrito está vacío.</div>`;
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.producto.imagen || ''}" alt="${item.producto.nombre}">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.producto.nombre}</div>
        <div class="cart-item-meta">
          ${item.talla ? 'Talla: ' + item.talla : ''}
          ${item.talla && item.color ? ' · ' : ''}
          ${item.color ? 'Color: ' + item.color : ''}
        </div>
      </div>
      <div class="cart-item-price">${fmt(item.precio)}</div>
      <span class="cart-item-remove" onclick="removeFromCart(${item.id})">×</span>
    </div>
  `).join('');
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartCount();
  renderCart();
}

function setDelivery(type) {
  deliveryType = type;
  const dRetiro   = document.getElementById('dRetiro');
  const dEnvio    = document.getElementById('dEnvio');
  const addrWrap  = document.getElementById('addressWrap');

  if (dRetiro)  dRetiro.classList.toggle('selected',  type === 'retiro');
  if (dEnvio)   dEnvio.classList.toggle('selected',   type === 'envio');
  if (addrWrap) addrWrap.style.display = type === 'envio' ? 'block' : 'none';
}

// ==================== WHATSAPP ====================
function sendWhatsApp() {
  if (!cart.length) { showToast('El carrito está vacío', 'error'); return; }

  const name = document.getElementById('orderName');
  const pago = document.getElementById('orderPago');
  const addr = document.getElementById('orderAddress');

  const nameVal = name ? name.value.trim() : '';
  const pagoVal = pago ? pago.value : '';
  const addrVal = addr ? addr.value.trim() : '';

  if (!nameVal)      { showToast('Escribe tu nombre',      'error'); return; }
  if (!pagoVal)      { showToast('Elige forma de pago',    'error'); return; }
  if (!deliveryType) { showToast('Elige tipo de entrega',  'error'); return; }
  if (deliveryType === 'envio' && !addrVal) { showToast('Escribe tu dirección', 'error'); return; }

  const total       = cart.reduce((s, i) => s + i.precio, 0);
  const productList = cart.map((item, idx) =>
    `  ${idx + 1}. ${item.producto.nombre}` +
    (item.talla ? ` | Talla: ${item.talla}` : '') +
    (item.color ? ` | Color: ${item.color}` : '') +
    ` | ${fmt(item.precio)}`
  ).join('\n');

  const entrega = deliveryType === 'retiro'
    ? 'Retiro en Tienda'
    : `Envío a Domicilio → ${addrVal}`;

  const msg =
`Nuevo Pedido — El Palma Inc.

Cliente: ${nameVal}

Productos:
${productList}

Total: ${fmt(total)}
Pago: ${pagoVal}
Entrega: ${entrega}`;

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ==================== MODALES ====================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function closeProductModal(e) {
  if (e.target === document.getElementById('productModal')) closeModal('productModal');
}

function closeCartModal(e) {
  if (e.target === document.getElementById('cartModal')) closeModal('cartModal');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('productModal');
    closeModal('cartModal');
  }
});

// ==================== TOAST ====================
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  t.className = `show ${type}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = '', 3000);
}

// ==================== STARFIELD ====================
(function() {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function createStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4,
        o: Math.random() * 0.7 + 0.1,
        s: Math.random() * 0.4 + 0.1,
        d: Math.random() > 0.5 ? 1 : -1
      });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.o += s.s * 0.01 * s.d;
      if (s.o > 0.8 || s.o < 0.1) s.d *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,225,255,${s.o})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', () => { resize(); createStars(220); });
  resize(); createStars(220); draw();
})();

// ==================== EXPONER AL HTML ====================
window.setCat             = setCat;
window.resetFilters       = resetFilters;
window.openProduct        = openProduct;
window.selectChip         = selectChip;
window.addToCart          = addToCart;
window.openCart           = openCart;
window.removeFromCart     = removeFromCart;
window.setDelivery        = setDelivery;
window.sendWhatsApp       = sendWhatsApp;
window.closeProductModal  = closeProductModal;
window.closeCartModal     = closeCartModal;
window.closeModal         = closeModal;