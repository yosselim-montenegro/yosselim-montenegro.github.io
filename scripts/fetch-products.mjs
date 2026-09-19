// Genera data/products.json a partir de la tienda personal de NuSkin.
// Misma lógica y misma forma de objeto que products.json del proyecto
// "Webscrap nuskin" (index.js) — a propósito, para no mantener dos
// estructuras de datos distintas del mismo catálogo.
// Corre standalone con Node 20+ (usa fetch nativo, sin dependencias).
import { mkdir, writeFile } from "node:fs/promises";

const SUBDOMAIN = "yosselimf";
const MARKET = "PE";
const STORE_ID = 422; // storefront de Perú, fijo para todas las mysite de este mercado
// client_id: API key pública embebida en el bundle JS del sitio (no es un secreto de sesión).
const CLIENT_ID = "63056848d7532f9923f3d08cb48c423b";
const HEADERS = {
  Origin: "https://www.nuskin.com",
  Referer: "https://www.nuskin.com/",
  Accept: "application/json",
};

function parseBenefits(rawJsonString) {
  try {
    const text = JSON.parse(rawJsonString || "{}").benefits || "";
    return text
      .split(/\n?\*\s+/)
      .map(s => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function parseUsage(rawJsonString) {
  try {
    return (JSON.parse(rawJsonString || "{}").additionalText || [])
      .map(s => s.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function parseIngredients(rawJsonString) {
  try {
    const first = JSON.parse(rawJsonString || "[]")[0] || {};
    return (first.keyIngredients || [])
      .map(k => ({ name: (k.name || "").trim(), description: (k.description || "").trim() }))
      .filter(k => k.name);
  } catch (_) {
    return [];
  }
}

// El origen (properties del producto vs. properties del sku) varía según el
// producto: se prueban ambos y se usa el primero que traiga contenido real.
function firstNonEmpty(parseFn, ...rawValues) {
  for (const raw of rawValues) {
    const parsed = parseFn(raw);
    if (parsed.length) return parsed;
  }
  return [];
}

async function getJson(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...HEADERS, ...extraHeaders } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${url}`);
  return res.json();
}

// Resuelve un producto por su id de contenido (blt...) que no está en la
// tienda personal (ej. un componente de kit no vendido por separado). El
// endpoint espera un "slug", pero acepta el id de contenido directamente
// (es el mismo fallback que usa el propio sitio cuando un producto no
// tiene slug propio).
const resolvedByContentIdCache = {};
async function resolveByContentId(contentId, sponsor) {
  if (resolvedByContentIdCache[contentId]) return resolvedByContentIdCache[contentId];
  let resolved;
  try {
    const data = await getJson(
      `https://apis.nuskin.com/storefront/catalogs/products/${contentId}?locale=es_${MARKET}&storeId=${STORE_ID}`,
      { "x-nuskin-sponsorid": sponsor }
    );
    const p = data.product?.[0];
    const skuProps = p?.sku?.[0]?.properties || {};
    // "bundleOnly" = NuSkin no lo vende suelto, solo como parte de un kit;
    // cualquier otro valor ("sellable", etc.) sí se puede comprar individual.
    const status = skuProps.productStatus || p?.properties?.productStatus || "";
    resolved = {
      name: p?.properties?.name || contentId,
      sku: p?.sku?.[0]?.identifier || contentId,
      sellable: status !== "bundleOnly" && !!p,
      raw: p,
    };
  } catch (_) {
    resolved = { name: contentId, sku: contentId, sellable: false, raw: null };
  }
  resolvedByContentIdCache[contentId] = resolved;
  return resolved;
}

// 1) subdomain -> código de sponsor (identifica la tienda)
const { sponsor } = await getJson(
  `https://api.cloud.nuskin.com/ns-share-api/v2/my-site/subdomain/${SUBDOMAIN}?market=${MARKET}`,
  { client_id: CLIENT_ID }
);

// 2) sponsor -> categorías personalizadas + SKUs de cada una
const published = await getJson(
  `https://api.cloud.nuskin.com/ns-share-api/v2/my-site/published/sponsor/${sponsor}?market=${MARKET}`,
  { client_id: CLIENT_ID }
);
const market = published.sponsor.market;
const categoryNames = {};
(market.lang?.es?.categoriesInfo || []).forEach(c => {
  categoryNames[c.categoryId] = (c.categoryName || "").trim();
});

const skuToCategory = {};
const allSkus = [];
(market.categories || []).forEach(cat => {
  const catName = categoryNames[cat.id] || "";
  (cat.skus || []).forEach(s => {
    allSkus.push(s.sku);
    if (!skuToCategory[s.sku]) skuToCategory[s.sku] = catName;
  });
});
const uniqueSkus = Array.from(new Set(allSkus));

// 3) SKUs -> detalle completo (precio, descripción, imágenes, contenido de kits)
const filter = JSON.stringify({ filters: [{ field: "groupskuid", operation: "IN", value: uniqueSkus.join(",") }] });
const enriched = await getJson(
  `https://apis.nuskin.com/storefront/catalogs/search?size=${uniqueSkus.length}&skipSearchContentful=true&filter=${encodeURIComponent(filter)}&locale=es_${MARKET}&storeId=${STORE_ID}`,
  { "x-customer-type": "guest", "x-nuskin-sponsorid": sponsor }
);
const products = enriched.product || [];

// Nombre de cada producto por su id, usado para resolver los nombres de los
// sub-productos incluidos en los kits (se referencian por id de contenido o
// por SKU numérico según el tipo de kit, así que se indexa por ambos).
const nameById = {};
products.forEach(p => {
  const name = p.properties?.name || "";
  nameById[p.identifier] = name;
  const numericSku = p.sku?.[0]?.identifier;
  if (numericSku) nameById[numericSku] = name;
});

// Construye el objeto final de un producto a partir de la respuesta cruda de
// la API. Función reutilizable: sirve tanto para los productos de su lista
// curada como para componentes de kit "descubiertos" después (vendibles
// individualmente pero no agregados a su tienda).
function buildProductEntry(p, fallbackCategory) {
  // "Empaquetado" (kit/bundle) se detecta por no traer el arreglo `sku`
  // anidado, no por el valor de `type`: hay variantes ("bundle", "kit") que
  // usan la misma estructura top-level pero distinto texto en `type`.
  const isBundle = !p.sku;
  const props = p.properties || {};
  const skuEntry = p.sku?.[0] || {};
  const skuProps = skuEntry.properties || {};
  const price = p.prices?.[0]?.price ?? "";

  // Precio con descuento: la combinación de TODO descuento activo (kit +
  // oferta propia si la hay), tal como se ve en su tienda.
  const totalValue = isBundle ? p.totalValue : skuEntry.totalValue;
  const hasOffer = !!(totalValue && totalValue.totaldiscount > 0);
  const salePrice = hasOffer ? totalValue.priceAfterDiscount : "";
  const promotions = p.promotion || [];
  const ownOffer = promotions.find(pr => pr.promotionClass === "SalesChannel");
  const offerMessage = ownOffer?.message || "";
  const isOwnOffer = !!ownOffer;

  let sku, name, description, available, includedItems;

  if (isBundle) {
    sku = p.identifier;
    name = props.name || "";
    description = props.description || "";
    available = (props.inventoryStatus || "").toUpperCase() === "IN STOCK";
    const componentsRaw = props.bundlemandatoryproductids || props.skukits || "";
    includedItems = componentsRaw
      .split(",")
      .filter(Boolean)
      .map(pair => {
        const [id, qty] = pair.split("~");
        return { sku: id, name: nameById[id] || id, quantity: Number(qty) || 1 };
      });
  } else {
    sku = skuEntry.identifier || p.identifier;
    name = props.name || skuProps.name || "";
    description = props.description || skuProps.description || "";
    available = skuEntry.inventoryProperties?.available ?? ((skuEntry.inventory || "").toUpperCase() === "IN STOCK");
    includedItems = [];
  }

  if (!description) {
    // Muchos productos no traen properties.description, pero sí
    // productDetails.description con el mismo texto de "Detalles del
    // producto". A veces props.productDetails viene vacío mientras que el
    // de skuProps sí está lleno, así que se prueban ambos.
    for (const raw of [skuProps.productDetails, props.productDetails]) {
      try {
        const text = (JSON.parse(raw || "{}").description || []).join(" ").trim();
        if (text) { description = text; break; }
      } catch (_) {}
    }
  }

  let benefits = parseBenefits(props.benefits || skuProps.benefits);
  if (benefits.length === 0) {
    for (const raw of [skuProps.productDetails, props.productDetails]) {
      try {
        const highlights = JSON.parse(raw || "{}").highlights || [];
        benefits = highlights.map(h => (h.label || "").trim()).filter(Boolean);
        if (benefits.length) break;
      } catch (_) {}
    }
  }

  if (!description) {
    try {
      const seo = JSON.parse(props.seoInformation || skuProps.seoInformation || "{}");
      description = seo.metaDescription || "";
    } catch (_) {}
  }

  const usage = firstNonEmpty(parseUsage, skuProps.usage, props.usage);
  const ingredients = firstNonEmpty(parseIngredients, skuProps.ingredients, props.ingredients);

  const brand = props.brand || skuProps.brand || "Nu Skin";
  const size = props.size || skuProps.size || "";

  let images = [];
  const rawImages = props.productImages || skuProps.productImages;
  if (rawImages) {
    try {
      images = JSON.parse(rawImages)
        .filter(img => img.url)
        .map((img, idx) => ({ order: idx + 1, url: img.url }));
    } catch (_) {}
  }
  if (images.length === 0) {
    const fallbackImage = props.imageURL || props.primaryimage || skuEntry.imageURL || skuProps.imageURL || "";
    if (fallbackImage) images = [{ order: 1, url: fallbackImage }];
  }

  return {
    sku,
    category: skuToCategory[sku] || fallbackCategory || "",
    name,
    brand,
    size,
    // Cuando no hay slug, el propio sitio de NuSkin arma la URL con el
    // identificador de contenido (confirmado en vivo: hay SKUs sin slug
    // cuya página real es /product/{identifier}).
    productUrl: `https://www.nuskin.com/pe/es/mysite/${SUBDOMAIN}/product/${props.slug || p.identifier}`,
    purchaseOptions: [{
      type: "BUY_ONCE",
      price: price !== "" ? `S/ ${price}` : "",
      salePrice: salePrice !== "" ? `S/ ${salePrice}` : "",
      offerMessage,
      isOwnOffer,
      stock: available ? "SI" : "NO",
    }],
    description,
    benefits,
    usage,
    ingredients,
    includedItems,
    includedInKits: [],
    images,
  };
}

const results = products.map(p => buildProductEntry(p));

// Componentes de kit que no estaban en su lista curada (por eso nameById
// no los conocía) se resuelven directo por su id de contenido. Si además se
// pueden comprar individualmente (no son "bundleOnly"), se agregan como
// producto suelto nuevo — los que solo vienen en kit se quedan como texto
// informativo nomás, sin ficha ni link propios.
const discoveredSkus = new Set(results.map(r => r.sku));
for (const kit of results) {
  for (const item of kit.includedItems) {
    if (item.name === item.sku) {
      const resolved = await resolveByContentId(item.sku, sponsor);
      item.name = resolved.name;
      item.sku = resolved.sku;
      if (resolved.sellable && !discoveredSkus.has(resolved.sku)) {
        discoveredSkus.add(resolved.sku);
        results.push(buildProductEntry(resolved.raw, "Otros productos"));
      }
    }
  }
}

// "Paquetes con este artículo": NuSkin no da esta relación directamente
// (los datos solo van kit -> componentes), pero como ya tenemos todos sus
// kits, se calcula el sentido inverso recorriendo los includedItems. Los
// componentes se referencian por id de contenido o por SKU numérico según
// el kit, así que se indexa por ambos (igual que nameById).
const resultById = {};
results.forEach((r, i) => {
  resultById[r.sku] = r;
  if (products[i]) resultById[products[i].identifier] = r;
});
results.forEach(kit => {
  kit.includedItems.forEach(item => {
    const target = resultById[item.sku];
    if (target && target !== kit) target.includedInKits.push({ sku: kit.sku, name: kit.name });
  });
});

await mkdir("data", { recursive: true });
await writeFile("data/products.json", JSON.stringify(results, null, 2));
console.log(`✅ Guardados ${results.length} productos en data/products.json`);
