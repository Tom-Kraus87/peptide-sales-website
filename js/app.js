const state = {
  products: [],
  categories: [],
  activeCategory: "all",
  searchQuery: "",
};

const selectors = {
  heroStats: document.getElementById("hero-stats"),
  searchInput: document.getElementById("search-input"),
  categoryFilters: document.getElementById("category-filters"),
  productGrid: document.getElementById("product-grid"),
  resultsCount: document.getElementById("results-count"),
  emptyState: document.getElementById("empty-state"),
  clearFilters: document.getElementById("clear-filters"),
  modal: document.getElementById("product-modal"),
  modalContent: document.getElementById("modal-content"),
  modalClose: document.querySelector(".modal-close"),
  cartButton: document.getElementById("cart-button"),
  cartCount: document.getElementById("cart-count"),
  cartDrawer: document.getElementById("cart-drawer"),
  cartBackdrop: document.getElementById("cart-backdrop"),
  cartItems: document.getElementById("cart-items"),
  cartSubtotal: document.getElementById("cart-subtotal"),
  cartCheckout: document.getElementById("cart-checkout"),
  cartClear: document.getElementById("cart-clear"),
};

async function loadCatalog() {
  let data = window.CATALOG_DATA;

  if (!data) {
    const response = await fetch("data/products.json");
    if (!response.ok) {
      throw new Error("Unable to load product catalog.");
    }
    data = await response.json();
  }

  state.products = data.products.map(applyPricing).sort(compareProducts);
  state.categories = data.categories;
  syncCartPrices();
  renderHeroStats(data);
  renderCategoryFilters();
  renderProducts();
  renderCart();
}

function renderHeroStats(data) {
  const uniqueProducts = new Set(data.products.map((product) => product.name)).size;

  selectors.heroStats.innerHTML = `
    <div class="stat-card">
      <strong>${data.productCount}</strong>
      <span>SKU listings</span>
    </div>
    <div class="stat-card">
      <strong>${uniqueProducts}</strong>
      <span>Unique peptides</span>
    </div>
    <div class="stat-card">
      <strong>${data.categories.length}</strong>
      <span>Categories</span>
    </div>
    <div class="stat-card">
      <strong>100%</strong>
      <span>Matched vial images</span>
    </div>
  `;
}

const PRODUCT_NAME_OVERRIDES = {
  Retatrutide: "GLP3",
};

const PRODUCT_SEARCH_ALIASES = {
  GLP3: "Retatrutide",
};

function skuSortParts(sku) {
  const match = String(sku).match(/^([A-Za-z]+)(\d+)(.*)$/);
  if (!match) {
    return [String(sku), 0, ""];
  }
  return [match[1], Number(match[2]), match[3]];
}

function compareProducts(a, b) {
  const category = a.category.localeCompare(b.category);
  if (category) {
    return category;
  }

  const name = a.name.localeCompare(b.name);
  if (name) {
    return name;
  }

  const [aPrefix, aNumber, aRest] = skuSortParts(a.sku);
  const [bPrefix, bNumber, bRest] = skuSortParts(b.sku);
  const prefix = aPrefix.localeCompare(bPrefix);
  if (prefix) {
    return prefix;
  }
  if (aNumber !== bNumber) {
    return aNumber - bNumber;
  }
  return aRest.localeCompare(bRest);
}

function applyPricing(product) {
  const kit = (window.KIT_PRICES || {})[product.sku];
  const name = PRODUCT_NAME_OVERRIDES[product.name] || product.name;
  const withStrength = {
    ...product,
    name,
    searchAliases: PRODUCT_SEARCH_ALIASES[name] || product.name,
    displayStrength: displayStrength(product.strength),
  };

  if (!kit) {
    return withStrength;
  }

  const perVialCost = kit.kitPrice / kit.vials;
  const markup =
    kit.kitPrice < (window.HIGH_PRICE_KIT_THRESHOLD || 100)
      ? window.LOW_PRICE_MARKUP || 15
      : window.HIGH_PRICE_MARKUP || 25;
  const perVialPrice = Math.round(perVialCost + markup);

  return {
    ...withStrength,
    displayStrength: displayStrength(product.strength),
    kitPrice: kit.kitPrice,
    vials: kit.vials,
    perVialCost: roundMoney(perVialCost),
    markup,
    perVialPrice,
  };
}

function displayStrength(strength) {
  return String(strength || "")
    .replace(/\s*[•·\u2022\u2013\u2014\-]\s*\d+\s*vials?/gi, "")
    .replace(/\s*\(\s*\d+\s*vials?\s*\)/gi, "")
    .trim();
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function syncCartPrices() {
  window.AuraCart.syncFromCatalog(state.products);
}

function formatMoney(value) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function addToCartMarkup(product) {
  if (!product.perVialPrice) {
    return `<a class="secondary-action" href="mailto:sales@aurakinetics.com?subject=${escapeAttribute(
      `Quote request for ${product.sku}`
    )}&body=${escapeAttribute(
      `Hello,\n\nI would like pricing and availability for:\n\nProduct: ${product.name}\nSKU: ${product.sku}\nStrength: ${product.displayStrength}\n\nThank you.`
    )}">Request quote</a>`;
  }

  return `<button type="button" class="price-action" data-action="add-to-cart" data-sku="${escapeAttribute(product.sku)}">Add to cart</button>`;
}

function renderCategoryFilters() {
  const chips = [
    `<button class="chip is-active" type="button" data-category="all">All products</button>`,
    ...state.categories.map(
      (category) =>
        `<button class="chip" type="button" data-category="${escapeHtml(category.name)}">${escapeHtml(category.name)} <span>(${category.count})</span></button>`
    ),
  ];

  selectors.categoryFilters.innerHTML = chips.join("");
}

function getFilteredProducts() {
  const query = state.searchQuery.trim().toLowerCase();

  return state.products.filter((product) => {
    const matchesCategory =
      state.activeCategory === "all" || product.category === state.activeCategory;

    if (!matchesCategory) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      product.name,
      product.searchAliases,
      product.sku,
      product.category,
      product.strength,
      product.description,
      product.status,
      product.perVialPrice ? String(product.perVialPrice) : "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();
  const hasFilters = state.activeCategory !== "all" || state.searchQuery.trim();

  selectors.resultsCount.textContent = `${filteredProducts.length} product${
    filteredProducts.length === 1 ? "" : "s"
  } shown`;
  selectors.clearFilters.hidden = !hasFilters;
  selectors.emptyState.hidden = filteredProducts.length > 0;
  selectors.productGrid.hidden = filteredProducts.length === 0;

  selectors.productGrid.innerHTML = filteredProducts
    .map((product) => createProductCard(product))
    .join("");
}

function createVialMarkup(product, size = 180) {
  if (!product.image) {
    return `<div class="description">Image unavailable</div>`;
  }

  return `
    <div class="vial-frame">
      <img
        class="vial-frame__photo"
        src="${escapeAttribute(product.image)}"
        alt="${escapeAttribute(product.name)} vial - ${escapeAttribute(product.displayStrength)}"
        loading="lazy"
        width="${size}"
        height="${Math.round((size * 240) / 180)}"
      />
      <div class="vial-label">
        <div class="vial-label__art">
          <img src="images/vial-label-bust.png" alt="" width="48" height="64" />
        </div>
        <div class="vial-label__copy">
          <strong class="vial-label__name">${escapeHtml(product.name)}</strong>
          <div class="vial-label__row">
            <span class="vial-label__strength">${escapeHtml(product.displayStrength)}</span>
            <img class="vial-label__mark" src="images/aura-kinetics-mark.svg" alt="" width="28" height="20" />
          </div>
          <span class="vial-label__disclaimer">For research use only</span>
        </div>
      </div>
    </div>
  `;
}

function createProductCard(product) {
  return `
    <article class="product-card" data-sku="${escapeAttribute(product.sku)}">
      <div class="product-card__media">${createVialMarkup(product, 180)}</div>
      <div class="product-card__body">
        <div class="product-card__top">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="strength">${escapeHtml(product.displayStrength)}</p>
            ${
              product.perVialPrice
                ? `<p class="product-price">${formatMoney(product.perVialPrice)} <span>/ vial</span></p>`
                : ""
            }
          </div>
          <span class="sku-badge">${escapeHtml(product.sku)}</span>
        </div>
        <span class="category-pill">${escapeHtml(product.category)}</span>
        <p class="description">${escapeHtml(product.description)}</p>
        <div class="product-card__labels">
          <span class="status-badge">${escapeHtml(product.status)}</span>
          <span class="brand-label">
            <img src="images/aura-kinetics-logo.png" alt="" width="18" height="18" />
            Aura Kinetics Human Optimization Systems
          </span>
        </div>
        <div class="product-card__actions">
          <button type="button" data-action="details" data-sku="${escapeAttribute(product.sku)}">View details</button>
          ${addToCartMarkup(product)}
        </div>
      </div>
    </article>
  `;
}

function openProductModal(product) {
  const sourceLinks = product.sourceUrls.length
    ? `<ul>${product.sourceUrls
        .map((url) => `<li><a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`)
        .join("")}</ul>`
    : "<p>No source links available.</p>";

  selectors.modalContent.innerHTML = `
    <div class="modal-hero">
      ${product.image ? createVialMarkup(product, 260) : ""}
      <div>
        <span class="category-pill">${escapeHtml(product.category)}</span>
        <h2 id="modal-title">${escapeHtml(product.name)}</h2>
        <p class="strength">${escapeHtml(product.displayStrength)}</p>
        ${
          product.perVialPrice
            ? `<p class="product-price">${formatMoney(product.perVialPrice)} <span>/ vial</span></p>`
            : ""
        }
        <span class="sku-badge">${escapeHtml(product.sku)}</span>
        <span class="status-badge">${escapeHtml(product.status)}</span>
        <span class="brand-label">
          <img src="images/aura-kinetics-logo.png" alt="" width="18" height="18" />
          Aura Kinetics Human Optimization Systems
        </span>
      </div>
    </div>
    ${
      product.perVialPrice
        ? `<div class="modal-section">
      <h4>Pricing</h4>
      <p>${formatMoney(product.perVialPrice)} per vial.</p>
    </div>`
        : ""
    }
    <div class="modal-section">
      <h4>Description</h4>
      <p>${escapeHtml(product.description)}</p>
    </div>
    <div class="modal-section">
      <h4>Caution / status notes</h4>
      <p>${escapeHtml(product.caution)}</p>
    </div>
    <div class="modal-section">
      <h4>Source references</h4>
      ${sourceLinks}
    </div>
    <div class="product-card__actions">
      ${addToCartMarkup(product)}
      <button type="button" data-action="close-modal">Close</button>
    </div>
  `;

  selectors.modal.showModal();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "%0A");
}

function addProductToCart(sku) {
  const product = state.products.find((item) => item.sku === sku);
  if (!product) {
    return;
  }

  window.AuraCart.add(product);
  openCart();
}

function openCart() {
  renderCart();
  selectors.cartDrawer.classList.add("is-open");
  selectors.cartDrawer.setAttribute("aria-hidden", "false");
  selectors.cartBackdrop.hidden = false;
  document.body.classList.add("cart-open");
}

function closeCart() {
  selectors.cartDrawer.classList.remove("is-open");
  selectors.cartDrawer.setAttribute("aria-hidden", "true");
  selectors.cartBackdrop.hidden = true;
  document.body.classList.remove("cart-open");
}

function renderCart() {
  const items = window.AuraCart.get();
  selectors.cartCount.textContent = String(window.AuraCart.count());

  if (!items.length) {
    selectors.cartItems.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
    selectors.cartSubtotal.textContent = formatMoney(0);
    selectors.cartCheckout.removeAttribute("href");
    selectors.cartCheckout.setAttribute("aria-disabled", "true");
    return;
  }

  selectors.cartCheckout.removeAttribute("aria-disabled");
  selectors.cartItems.innerHTML = items
    .map(
      (item) => `
      <article class="cart-item" data-sku="${escapeAttribute(item.sku)}">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.strength)} · ${escapeHtml(item.sku)}</p>
          <p class="cart-item__price">${formatMoney(item.price)} / vial</p>
        </div>
        <div class="cart-item__controls">
          <label>
            <span class="sr-only">Quantity for ${escapeHtml(item.name)}</span>
            <input type="number" min="1" max="99" value="${item.quantity}" data-action="cart-qty" data-sku="${escapeAttribute(item.sku)}" />
          </label>
          <button type="button" data-action="cart-remove" data-sku="${escapeAttribute(item.sku)}">Remove</button>
        </div>
      </article>
    `
    )
    .join("");

  const subtotal = window.AuraCart.subtotal();
  selectors.cartSubtotal.textContent = formatMoney(subtotal);
  selectors.cartCheckout.href = buildCheckoutMailto(items, subtotal);
}

function buildCheckoutMailto(items, subtotal) {
  const lines = items.map(
    (item) =>
      `${item.name} (${item.sku}, ${item.strength}) x ${item.quantity} = ${formatMoney(item.price * item.quantity)}`
  );
  const body = `Hello,\n\nI would like to order the following vials:\n\n${lines.join(
    "\n"
  )}\n\nSubtotal: ${formatMoney(subtotal)}\n\nThank you.`;

  return `mailto:sales@aurakinetics.com?subject=${escapeAttribute(
    "Vial order from Aura Kinetics catalog"
  )}&body=${escapeAttribute(body)}`;
}

function bindEvents() {
  selectors.searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    renderProducts();
  });

  selectors.categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }

    state.activeCategory = button.dataset.category;
    selectors.categoryFilters
      .querySelectorAll(".chip")
      .forEach((chip) => chip.classList.toggle("is-active", chip === button));
    renderProducts();
  });

  selectors.clearFilters.addEventListener("click", () => {
    state.activeCategory = "all";
    state.searchQuery = "";
    selectors.searchInput.value = "";
    selectors.categoryFilters
      .querySelectorAll(".chip")
      .forEach((chip, index) => chip.classList.toggle("is-active", index === 0));
    renderProducts();
  });

  selectors.productGrid.addEventListener("click", (event) => {
    const addButton = event.target.closest('[data-action="add-to-cart"]');
    if (addButton) {
      addProductToCart(addButton.dataset.sku);
      return;
    }

    const detailsButton = event.target.closest('[data-action="details"]');
    if (!detailsButton) {
      return;
    }

    const product = state.products.find((item) => item.sku === detailsButton.dataset.sku);
    if (product) {
      openProductModal(product);
    }
  });

  selectors.modal.addEventListener("click", (event) => {
    if (event.target === selectors.modal) {
      selectors.modal.close();
    }
  });

  selectors.modalContent.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="close-modal"]')) {
      selectors.modal.close();
    }

    const addButton = event.target.closest('[data-action="add-to-cart"]');
    if (addButton) {
      addProductToCart(addButton.dataset.sku);
      selectors.modal.close();
    }
  });

  selectors.modalClose.addEventListener("click", () => selectors.modal.close());

  selectors.cartButton.addEventListener("click", openCart);
  selectors.cartBackdrop.addEventListener("click", closeCart);
  selectors.cartDrawer.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="close-cart"]')) {
      closeCart();
    }

    const removeButton = event.target.closest('[data-action="cart-remove"]');
    if (removeButton) {
      window.AuraCart.remove(removeButton.dataset.sku);
    }
  });
  selectors.cartItems.addEventListener("change", (event) => {
    const qtyInput = event.target.closest('[data-action="cart-qty"]');
    if (qtyInput) {
      window.AuraCart.setQuantity(qtyInput.dataset.sku, qtyInput.value);
    }
  });
  selectors.cartClear.addEventListener("click", () => window.AuraCart.clear());
  window.addEventListener("cart-updated", renderCart);
}

loadCatalog().catch((error) => {
  selectors.resultsCount.textContent = "Failed to load catalog.";
  selectors.emptyState.hidden = false;
  selectors.emptyState.querySelector("p").textContent = error.message;
  selectors.productGrid.hidden = true;
});

bindEvents();
