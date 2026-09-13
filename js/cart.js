const CART_STORAGE_KEY = "aura-kinetics-cart";

window.AuraCart = {
  get() {
    try {
      const items = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  },

  save(items) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart-updated"));
  },

  count() {
    return this.get().reduce((total, item) => total + item.quantity, 0);
  },

  subtotal() {
    return this.get().reduce((total, item) => total + item.price * item.quantity, 0);
  },

  add(product) {
    if (!product?.sku || !product.perVialPrice) {
      return;
    }

    const items = this.get();
    const existing = items.find((item) => item.sku === product.sku);

    if (existing) {
      existing.quantity += 1;
      existing.price = product.perVialPrice;
      existing.name = product.name;
    } else {
      items.push({
        sku: product.sku,
        name: product.name,
        strength: product.displayStrength || product.strength,
        price: product.perVialPrice,
        image: product.image,
        quantity: 1,
      });
    }

    this.save(items);
  },

  syncFromCatalog(products) {
    const bySku = new Map(products.map((product) => [product.sku, product]));
    const items = this.get();
    let changed = false;
    const next = items.map((item) => {
      const product = bySku.get(item.sku);
      if (!product) {
        return item;
      }

      const price = product.perVialPrice || item.price;
      const name = product.name || item.name;
      if (item.price === price && item.name === name) {
        return item;
      }

      changed = true;
      return { ...item, price, name };
    });

    if (changed) {
      this.save(next);
    }
  },

  setQuantity(sku, quantity) {
    const nextQuantity = Number(quantity);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
      this.remove(sku);
      return;
    }

    const items = this.get().map((item) =>
      item.sku === sku ? { ...item, quantity: Math.min(99, Math.floor(nextQuantity)) } : item
    );
    this.save(items);
  },

  remove(sku) {
    this.save(this.get().filter((item) => item.sku !== sku));
  },

  clear() {
    this.save([]);
  },
};
