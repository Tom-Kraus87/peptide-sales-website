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

  state.products = data.products;
  state.categories = data.categories;
  renderHeroStats(data);
  renderCategoryFilters();
  renderProducts();
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
      product.sku,
      product.category,
      product.strength,
      product.description,
      product.status,
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

function createProductCard(product) {
  const imageMarkup = product.image
    ? `<img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} vial - ${escapeAttribute(product.strength)}" loading="lazy" width="180" height="180" />`
    : `<div class="description">Image unavailable</div>`;

  return `
    <article class="product-card" data-sku="${escapeAttribute(product.sku)}">
      <div class="product-card__media">${imageMarkup}</div>
      <div class="product-card__body">
        <div class="product-card__top">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="strength">${escapeHtml(product.strength)}</p>
          </div>
          <span class="sku-badge">${escapeHtml(product.sku)}</span>
        </div>
        <span class="category-pill">${escapeHtml(product.category)}</span>
        <p class="description">${escapeHtml(product.description)}</p>
        <span class="status-badge">${escapeHtml(product.status)}</span>
        <div class="product-card__actions">
          <button type="button" data-action="details" data-sku="${escapeAttribute(product.sku)}">View details</button>
          <a class="secondary-action" href="mailto:sales@peptidelab.com?subject=${escapeAttribute(
            `Quote request for ${product.sku}`
          )}&body=${escapeAttribute(
            `Hello,\n\nI would like pricing and availability for:\n\nProduct: ${product.name}\nSKU: ${product.sku}\nStrength: ${product.strength}\n\nThank you.`
          )}">Request quote</a>
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
      ${
        product.image
          ? `<img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} vial" width="220" height="220" />`
          : ""
      }
      <div>
        <span class="category-pill">${escapeHtml(product.category)}</span>
        <h2 id="modal-title">${escapeHtml(product.name)}</h2>
        <p class="strength">${escapeHtml(product.strength)}</p>
        <span class="sku-badge">${escapeHtml(product.sku)}</span>
        <span class="status-badge">${escapeHtml(product.status)}</span>
      </div>
    </div>
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
      <a class="secondary-action" href="mailto:sales@peptidelab.com?subject=${escapeAttribute(
        `Quote request for ${product.sku}`
      )}&body=${escapeAttribute(
        `Hello,\n\nI would like pricing and availability for:\n\nProduct: ${product.name}\nSKU: ${product.sku}\nStrength: ${product.strength}\n\nThank you.`
      )}">Email sales team</a>
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
    const button = event.target.closest('[data-action="details"]');
    if (!button) {
      return;
    }

    const product = state.products.find((item) => item.sku === button.dataset.sku);
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
  });

  selectors.modalClose.addEventListener("click", () => selectors.modal.close());
}

loadCatalog().catch((error) => {
  selectors.resultsCount.textContent = "Failed to load catalog.";
  selectors.emptyState.hidden = false;
  selectors.emptyState.querySelector("p").textContent = error.message;
  selectors.productGrid.hidden = true;
});

bindEvents();
