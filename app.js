  document.getElementById('year').textContent = new Date().getFullYear();

  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  menuToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ---- Rutina día/noche toggle ----
  const rutinaSection = document.getElementById('rutina');
  document.querySelectorAll('.rutina-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      rutinaSection.dataset.mode = mode;
      document.querySelectorAll('.rutina-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.rutina-card').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === mode);
      });
    });
  });

  // ---- Infinite peek carousel (pillars, testimonios) ----
  function makeInfiniteCarousel(track) {
    const items = Array.from(track.children);
    if (items.length < 2) return;

    items.forEach(el => track.appendChild(el.cloneNode(true)));
    [...items].reverse().forEach(el => track.insertBefore(el.cloneNode(true), track.firstChild));

    let setWidth = 0;
    function measure() {
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      setWidth = items.reduce((sum, el) => sum + el.getBoundingClientRect().width + gap, 0);
      track.scrollLeft = setWidth;
    }
    requestAnimationFrame(measure);
    window.addEventListener('resize', measure);

    let ticking = false;
    track.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (setWidth > 0) {
          if (track.scrollLeft <= 4) track.scrollLeft += setWidth;
          else if (track.scrollLeft >= setWidth * 2 - 4) track.scrollLeft -= setWidth;
        }
        ticking = false;
      });
    });
  }
  ['pillarsCarousel', 'testiCarousel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) makeInfiniteCarousel(el);
  });

  // ---- Catálogo + destacados + modal (data/products.json) ----
  (async () => {
    const tabsEl = document.getElementById('catalogoTabs');
    const gridEl = document.getElementById('catalogoGrid');
    const loadingEl = document.getElementById('catalogoLoading');
    const featuredEl = document.getElementById('productoCarousel');
    if (!tabsEl || !gridEl) return;

    let products;
    try {
      const res = await fetch('data/products.json');
      products = await res.json();
    } catch (e) {
      loadingEl.textContent = 'No se pudo cargar el catálogo. Intenta recargar la página.';
      return;
    }
    loadingEl.hidden = true;

    const productsBySku = new Map(products.map(p => [p.sku, p]));
    // Los SKU dentro de includedItems/includedInKits a veces son IDs internos
    // del CMS que no coinciden con ningún sku del catálogo: en ese caso se
    // busca el producto por nombre exacto como respaldo.
    const productsByName = new Map(products.map(p => [p.name, p]));
    const resolveRef = (item) => productsBySku.get(item.sku) || productsByName.get(item.name);

    // products.json se regenera entero cada día (scripts/fetch-products.mjs),
    // así que los destacados se eligen por SKU aquí y no con un campo en el JSON.
    const FEATURED_SKUS = ['60002208', '60001994', '60001647', '60004368', '60004442', '60130443', '60130353'];

    const WA_PHONE = '51942029354';
    const waLink = (name) =>
      `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(`Hola, quiero consultar sobre ${name}`)}`;
    const waCartLink = (p) =>
      p.sku ? `https://wa.me/p/${p.sku}/${WA_PHONE}` : waLink(p.name);
    const formatPrice = (n) => `S/ ${Number(n).toFixed(2)}`;
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    // El texto scrapeado a veces trae asteriscos de nota al pie escapados en
    // markdown ("semanas\*") que se ven como una barra invertida suelta.
    const cleanText = (s) => String(s || '').replace(/\\([*_~`])/g, '$1');
    // products.json trae precios como texto ("S/ 383") porque es la misma
    // estructura que se usa para subir al catálogo de Meta.
    const parsePrice = (s) => {
      const n = parseFloat(String(s || '').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const getPricing = (p) => {
      const opt = p.purchaseOptions?.[0] || {};
      return {
        price: parsePrice(opt.price),
        salePrice: parsePrice(opt.salePrice),
        inStock: opt.stock === 'SI',
      };
    };
    const priceHtmlOf = (p) => {
      const { price, salePrice } = getPricing(p);
      return salePrice
        ? `<span class="before">${formatPrice(price)}</span><span class="now">${formatPrice(salePrice)}</span>`
        : `<span class="now">${formatPrice(price)}</span>`;
    };

    const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
    const waSvg = '<svg viewBox="0 0 448 512" fill="currentColor"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 438.1h-.1c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 55.7 81.2 55.6 130.5 0 101.8-84.9 184.6-186.1 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>';

    function renderCard(p, i) {
      const name = escapeHtml(p.name);
      const { inStock } = getPricing(p);
      const image = p.images?.[0]?.url || '';
      return `
        <div class="catalogo-card" data-sku="${p.sku}" style="animation-delay:${Math.min(i * 30, 300)}ms">
          ${!inStock ? '<span class="catalogo-badge">Agotado</span>' : ''}
          <div class="photo-frame">
            <img src="${escapeHtml(image)}" alt="${name}" loading="lazy">
            <div class="catalogo-price-badge">${priceHtmlOf(p)}</div>
          </div>
          <div class="catalogo-card-body">
            <h4>${name}</h4>
            <a class="btn btn-cart" href="${waCartLink(p)}" target="_blank" rel="noopener" data-no-modal>
              ${waSvg}
              Comprar en
            </a>
          </div>
        </div>`;
    }

    function renderGrid(category) {
      gridEl.innerHTML = products
        .filter(p => p.category === category)
        .map(renderCard)
        .join('');
    }

    function renderFeaturedCard(p) {
      const name = escapeHtml(p.name);
      const image = p.images?.[0]?.url || '';
      return `
        <div class="producto-grid" data-sku="${p.sku}">
          <div class="photo-frame square"><img src="${escapeHtml(image)}" alt="${name}" loading="lazy"></div>
          <div>
            <span class="eyebrow">Producto destacado</span>
            <h3>${name}</h3>
            <div class="producto-grid-desc"><p>${escapeHtml(p.description || '').trim()}</p></div>
            <button type="button" class="btn btn-avail" data-open-sku="${p.sku}">Ver beneficios</button>
          </div>
        </div>`;
    }

    if (featuredEl) {
      const featured = FEATURED_SKUS.map(sku => productsBySku.get(sku)).filter(Boolean);
      featuredEl.innerHTML = featured.map(renderFeaturedCard).join('');
      if (featured.length) makeInfiniteCarousel(featuredEl);
    }

    const categoryEmoji = {
      'Manchas, rostro, cuerpo': '🧖🏻‍♀️',
      'Reposición de Geles y serum': '🧴',
      'Salud Interna': '💊',
      'Dispositivos antiedad': '💆🏻‍♀️',
      'Kits de básicos para emprender': '📦',
      'Otros productos': '🏷️',
    };

    const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
    tabsEl.innerHTML = categories
      .map((c, i) => `<button class="catalogo-tab${i === 0 ? ' active' : ''}" data-cat="${c}">${categoryEmoji[c] ? `<span class="catalogo-tab-emoji">${categoryEmoji[c]}</span>` : ''}<span class="catalogo-tab-label"><span>${c}</span></span></button>`)
      .join('') + '<div class="catalogo-tabs-break"></div>';

    tabsEl.querySelectorAll('.catalogo-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsEl.querySelectorAll('.catalogo-tab').forEach(t => t.classList.toggle('active', t === tab));
        renderGrid(tab.dataset.cat);
      });
    });

    if (categories.length) renderGrid(categories[0]);

    // ---- Modal de producto (imágenes + beneficios completos) ----
    const modal = document.getElementById('productModal');
    if (modal) {
      const modalImg = modal.querySelector('.product-modal-img');
      const modalDots = modal.querySelector('.product-modal-dots');
      const modalPrev = modal.querySelector('.product-modal-nav.prev');
      const modalNext = modal.querySelector('.product-modal-nav.next');
      const modalName = modal.querySelector('.product-modal-name');
      const modalMeta = modal.querySelector('.product-modal-meta');
      const modalPrice = modal.querySelector('.product-modal-price');
      const modalTabbar = modal.querySelector('.product-modal-tabbar');
      const modalTabpanel = modal.querySelector('.product-modal-tabpanel');
      const modalScroll = modal.querySelector('.product-modal-scroll');
      const modalBuy = modal.querySelector('.product-modal-buy');
      const modalBack = modal.querySelector('.product-modal-back');

      let currentImages = [];
      let currentImgIndex = 0;
      let currentTabs = [];
      let currentProduct = null;
      let navStack = [];

      function showImage(idx) {
        currentImgIndex = idx;
        modalImg.src = currentImages[idx]?.url || '';
        modalDots.querySelectorAll('span').forEach((d, di) => d.classList.toggle('active', di === idx));
      }

      const boxSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>';

      function renderChip(item) {
        const ref = resolveRef(item);
        const image = ref?.images?.[0]?.url || '';
        const qty = item.quantity > 1 ? `<span class="chip-qty">x${item.quantity}</span>` : '';
        return `
          <div class="product-modal-chip" ${ref ? `data-sku="${ref.sku}"` : ''}>
            ${image ? `<img src="${escapeHtml(image)}" alt="">` : `<span class="chip-noimg">${boxSvg}</span>`}
            <span class="chip-name">${escapeHtml(item.name)}</span>
            ${qty}
          </div>`;
      }

      function showTab(idx) {
        if (!currentTabs.length) return;
        modalTabpanel.innerHTML = currentTabs[idx].html;
        modalTabbar.querySelectorAll('.product-modal-tab').forEach((b, i) => b.classList.toggle('active', i === idx));
      }

      function buildTabs(p) {
        const tabs = [];
        // La descripción y el modo de uso vienen del catálogo de Nu Skin y
        // pueden traer HTML propio (negritas, saltos de línea): se insertan
        // tal cual en vez de escaparlas para que se vean bien formateadas.
        if (p.description) {
          tabs.push({ title: 'Descripción', html: `<p>${cleanText(p.description)}</p>` });
        }
        if (p.includedItems && p.includedItems.length) {
          tabs.push({ title: 'Productos incluidos', html: `<div class="product-modal-included">${p.includedItems.map(renderChip).join('')}</div>` });
        } else if (p.includedInKits && p.includedInKits.length) {
          tabs.push({ title: 'Incluido en', html: `<div class="product-modal-included">${p.includedInKits.map(renderChip).join('')}</div>` });
        }
        if (p.benefits && p.benefits.length) {
          // Algunos kits traen varios puntos separados por "•" dentro de un
          // mismo texto de beneficio: se separan para que cada uno sea su
          // propio ítem de lista en vez de un solo bloque con viñetas sueltas.
          const benefitItems = p.benefits.flatMap(b => b.split('•').map(s => cleanText(s.trim())).filter(Boolean));
          tabs.push({ title: 'Beneficios', html: `<ul class="beneficios product-modal-benefits">${benefitItems.map(b => `<li>${checkSvg} ${escapeHtml(b)}</li>`).join('')}</ul>` });
        }
        if (p.usage && p.usage.length) {
          tabs.push({ title: 'Modo de uso', html: p.usage.map(u => `<p>${cleanText(u)}</p>`).join('') });
        }
        if (p.ingredients && p.ingredients.length) {
          const items = p.ingredients.map(ing => `<li>${checkSvg}<span><strong>${escapeHtml(ing.name || '')}</strong>${cleanText(ing.description)}</span></li>`).join('');
          tabs.push({ title: 'Ingredientes', html: `<ul class="product-modal-ingredients">${items}</ul>` });
        }
        return tabs;
      }

      function openModal(p, { navigate, back } = {}) {
        if (navigate && currentProduct) navStack.push(currentProduct);
        else if (!back) navStack = [];
        currentProduct = p;
        modalBack.hidden = !navStack.length;

        currentImages = [...(p.images || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        modalImg.alt = p.name;
        modalName.textContent = p.name;
        modalMeta.textContent = [p.brand, p.size].filter(Boolean).join(' · ');
        modalPrice.innerHTML = priceHtmlOf(p);
        modalBuy.href = waCartLink(p);

        currentTabs = buildTabs(p);
        modalTabbar.innerHTML = currentTabs
          .map((t, i) => `<button type="button" class="product-modal-tab${i === 0 ? ' active' : ''}" data-idx="${i}">${t.title}</button>`)
          .join('');
        modalTabbar.hidden = !currentTabs.length;
        showTab(0);

        const multi = currentImages.length > 1;
        modalPrev.hidden = !multi;
        modalNext.hidden = !multi;
        modalDots.innerHTML = multi
          ? currentImages.map((_, di) => `<span></span>`).join('')
          : '';
        showImage(0);

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        modalScroll.scrollTop = 0;
      }

      function goBack() {
        const prev = navStack.pop();
        if (prev) openModal(prev, { back: true });
      }

      function closeModal() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        currentProduct = null;
        navStack = [];
      }

      modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
      modalBack.addEventListener('click', goBack);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
      });
      modalPrev.addEventListener('click', () => showImage((currentImgIndex - 1 + currentImages.length) % currentImages.length));
      modalNext.addEventListener('click', () => showImage((currentImgIndex + 1) % currentImages.length));
      modalTabbar.addEventListener('click', (e) => {
        const tab = e.target.closest('.product-modal-tab');
        if (tab) showTab(Number(tab.dataset.idx));
      });
      modalTabpanel.addEventListener('click', (e) => {
        const chip = e.target.closest('.product-modal-chip[data-sku]');
        if (!chip) return;
        const p = productsBySku.get(chip.dataset.sku);
        if (p) openModal(p, { navigate: true });
      });

      function bindCardOpen(container) {
        container.addEventListener('click', (e) => {
          if (e.target.closest('[data-no-modal]') || e.target.closest('[data-open-sku]')) {
            const openBtn = e.target.closest('[data-open-sku]');
            if (openBtn) {
              const p = productsBySku.get(openBtn.dataset.openSku);
              if (p) openModal(p);
            }
            return;
          }
          const card = e.target.closest('[data-sku]');
          if (!card) return;
          const p = productsBySku.get(card.dataset.sku);
          if (p) openModal(p);
        });
      }
      bindCardOpen(gridEl);
      if (featuredEl) bindCardOpen(featuredEl);
    }
  })();
