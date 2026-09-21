/**
 * Generate real-world-shaped public JSON datasets under `src/json/`.
 *
 * These files are NOT wired into `PUBLIC_JSON_COLLECTIONS` / seed yet.
 *
 * Volume is tiered by structural complexity (default):
 *   simple        → 1000  (flat / shallow nesting, no line-item graphs)
 *   mid-high      → 200–300 (arrays + multi-section nesting)
 *   extreme       → 100   (deep nesting + line items / rich media graphs)
 *
 *   node scripts/generate-world-json.js           # tiered defaults
 *   node scripts/generate-world-json.js --count=50  # force same count everywhere
 *
 * Shared IDs link companies → customers/employees/orders/tickets/invoices/etc.
 * Media uses https://placehold.co placeholders (not real CDN assets).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "src", "json");

/**
 * Complexity tiers → document counts.
 * Override all with `--count=N` when experimenting.
 */
const TIERED_COUNTS = {
  // simple
  companies: 1000,
  customers: 1000,
  employees: 1000,
  transactions: 1000,
  subscriptions: 1000,
  appointments: 1000,
  // mid-high
  invoices: 300,
  projects: 250,
  "support-ticket": 250,
  shipments: 200,
  // extreme
  inventory: 100,
  orders: 100,
};

const countArg = process.argv.find((a) => a.startsWith("--count="));
const FORCE_COUNT = countArg
  ? Math.max(1, Number(countArg.split("=")[1]))
  : null;

const counts = Object.fromEntries(
  Object.entries(TIERED_COUNTS).map(([key, n]) => [
    key,
    FORCE_COUNT ?? n,
  ])
);

/** Deterministic PRNG so regenerating the same count yields the same IDs/shapes. */
function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rand = createRng(20260321);

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const money = (min, max, decimals = 2) =>
  Number((rand() * (max - min) + min).toFixed(decimals));
const pad = (n, w = 4) => String(n).padStart(w, "0");
const iso = (daysAgo, hour = 12, minute = 0) => {
  const d = new Date(Date.UTC(2026, 0, 15, hour, minute, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

/** Industry-common placeholder image helper (placehold.co). */
const ph = (w, h, text) =>
  `https://placehold.co/${w}x${h}/png?text=${encodeURIComponent(text)}`;

const FIRST = [
  "Ada", "Grace", "Alan", "Linus", "Margaret", "Katherine", "Tim", "Guido",
  "Barbara", "Donald", "Radia", "Ken", "James", "Brendan", "Sophie", "Omar",
  "Priya", "Yuki", "Elena", "Noah",
];
const LAST = [
  "Lovelace", "Hopper", "Turing", "Torvalds", "Hamilton", "Johnson",
  "Berners-Lee", "van Rossum", "Liskov", "Knuth", "Perlman", "Thompson",
  "Gosling", "Eich", "Chen", "Hassan", "Sharma", "Tanaka", "Petrov", "Kim",
];
const INDUSTRIES = [
  "software", "fintech", "healthcare", "retail", "logistics",
  "manufacturing", "education", "media", "energy", "hospitality",
];
const COUNTRIES = [
  { code: "US", city: "New York", region: "NY", tz: "America/New_York" },
  { code: "US", city: "San Francisco", region: "CA", tz: "America/Los_Angeles" },
  { code: "GB", city: "London", region: "ENG", tz: "Europe/London" },
  { code: "DE", city: "Berlin", region: "BE", tz: "Europe/Berlin" },
  { code: "IN", city: "Bengaluru", region: "KA", tz: "Asia/Kolkata" },
  { code: "SG", city: "Singapore", region: "SG", tz: "Asia/Singapore" },
  { code: "JP", city: "Tokyo", region: "13", tz: "Asia/Tokyo" },
  { code: "BR", city: "São Paulo", region: "SP", tz: "America/Sao_Paulo" },
  { code: "AU", city: "Sydney", region: "NSW", tz: "Australia/Sydney" },
  { code: "CA", city: "Toronto", region: "ON", tz: "America/Toronto" },
];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "SGD", "JPY"];
const LANGUAGES = ["en", "en", "es", "de", "fr", "hi", "ja", "pt"];

const SKUS = [
  {
    sku: "SKU-WLS-1001",
    name: "Wireless Mouse Pro",
    brand: "LogiTechie",
    category: "electronics",
    subcategory: "peripherals",
    unitCost: 12.5,
    listPrice: 29.99,
    uom: "EA",
    weightKg: 0.098,
    dimensionsCm: { length: 12, width: 6.5, height: 4 },
    description: "Ergonomic 2.4GHz wireless mouse with silent clicks and USB-C receiver.",
  },
  {
    sku: "SKU-KB-2002",
    name: "Mechanical Keyboard",
    brand: "KeyForge",
    category: "electronics",
    subcategory: "peripherals",
    unitCost: 48.0,
    listPrice: 119.0,
    uom: "EA",
    weightKg: 0.95,
    dimensionsCm: { length: 44, width: 13, height: 4 },
    description: "Hot-swappable mechanical keyboard with RGB backlight and aluminum frame.",
  },
  {
    sku: "SKU-HD-3003",
    name: "USB-C Hub 8-in-1",
    brand: "PortaLink",
    category: "electronics",
    subcategory: "adapters",
    unitCost: 29.9,
    listPrice: 69.0,
    uom: "EA",
    weightKg: 0.12,
    dimensionsCm: { length: 11, width: 4, height: 1.5 },
    description: "8-in-1 USB-C hub with HDMI 4K, ethernet, SD, and dual USB-A ports.",
  },
  {
    sku: "SKU-MN-4004",
    name: "27in 4K Monitor",
    brand: "VistaDisplay",
    category: "electronics",
    subcategory: "displays",
    unitCost: 220.0,
    listPrice: 449.0,
    uom: "EA",
    weightKg: 5.4,
    dimensionsCm: { length: 62, width: 45, height: 20 },
    description: "27-inch IPS 4K UHD monitor with USB-C 65W power delivery.",
  },
  {
    sku: "SKU-CH-5005",
    name: "Ergonomic Office Chair",
    brand: "SitWell",
    category: "furniture",
    subcategory: "seating",
    unitCost: 185.0,
    listPrice: 399.0,
    uom: "EA",
    weightKg: 18.2,
    dimensionsCm: { length: 70, width: 70, height: 120 },
    description: "Adjustable lumbar support mesh chair with 4D armrests.",
  },
  {
    sku: "SKU-DS-6006",
    name: "Standing Desk Frame",
    brand: "ElevateDesk",
    category: "furniture",
    subcategory: "desks",
    unitCost: 310.0,
    listPrice: 599.0,
    uom: "EA",
    weightKg: 28.0,
    dimensionsCm: { length: 140, width: 70, height: 15 },
    description: "Electric dual-motor standing desk frame with memory presets.",
  },
  {
    sku: "SKU-NB-7007",
    name: "Notebook A5 Pack",
    brand: "PaperCraft",
    category: "office",
    subcategory: "stationery",
    unitCost: 4.25,
    listPrice: 12.0,
    uom: "PK",
    weightKg: 0.45,
    dimensionsCm: { length: 21, width: 15, height: 3 },
    description: "Pack of 3 dotted A5 notebooks, 160 pages, recycled paper.",
  },
  {
    sku: "SKU-PN-8008",
    name: "Gel Pen Box (12)",
    brand: "InkFlow",
    category: "office",
    subcategory: "stationery",
    unitCost: 6.8,
    listPrice: 14.99,
    uom: "BX",
    weightKg: 0.18,
    dimensionsCm: { length: 16, width: 8, height: 3 },
    description: "12-pack 0.5mm gel pens, smear-resistant quick-dry ink.",
  },
  {
    sku: "SKU-BG-9009",
    name: "Laptop Backpack 20L",
    brand: "CarryOn",
    category: "accessories",
    subcategory: "bags",
    unitCost: 39.5,
    listPrice: 89.0,
    uom: "EA",
    weightKg: 0.85,
    dimensionsCm: { length: 45, width: 30, height: 18 },
    description: "Water-resistant 20L backpack with padded 16-inch laptop sleeve.",
  },
  {
    sku: "SKU-HDPH-1010",
    name: "Noise Cancelling Headphones",
    brand: "SoundNest",
    category: "electronics",
    subcategory: "audio",
    unitCost: 129.0,
    listPrice: 279.0,
    uom: "EA",
    weightKg: 0.255,
    dimensionsCm: { length: 20, width: 18, height: 8 },
    description: "Over-ear ANC headphones with 30h battery and multipoint Bluetooth.",
  },
];

const WAREHOUSES = [
  { id: "wh_us_nyc_01", code: "NYC-01", name: "New York FC", country: "US", region: "NY", timezone: "America/New_York" },
  { id: "wh_us_sfo_01", code: "SFO-01", name: "Bay Area FC", country: "US", region: "CA", timezone: "America/Los_Angeles" },
  { id: "wh_gb_lon_01", code: "LON-01", name: "London FC", country: "GB", region: "ENG", timezone: "Europe/London" },
  { id: "wh_de_ber_01", code: "BER-01", name: "Berlin FC", country: "DE", region: "BE", timezone: "Europe/Berlin" },
  { id: "wh_in_blr_01", code: "BLR-01", name: "Bengaluru FC", country: "IN", region: "KA", timezone: "Asia/Kolkata" },
  { id: "wh_sg_sin_01", code: "SIN-01", name: "Singapore FC", country: "SG", region: "SG", timezone: "Asia/Singapore" },
];

const SUPPLIERS = [
  { id: "sup_0001", name: "Northwind Components", code: "NWC", country: "US" },
  { id: "sup_0002", name: "EuroParts GmbH", code: "EPG", country: "DE" },
  { id: "sup_0003", name: "Pacific Supply Co", code: "PSC", country: "SG" },
  { id: "sup_0004", name: "Deccan Traders", code: "DCT", country: "IN" },
];

const DEPARTMENTS = [
  "Engineering", "Product", "Sales", "Support", "Finance", "People", "Operations", "Marketing",
];
const JOB_TITLES = [
  "Software Engineer", "Senior Engineer", "Product Manager", "Account Executive",
  "Support Specialist", "Financial Analyst", "People Partner", "Ops Coordinator",
  "Marketing Manager", "Engineering Manager",
];
const TICKET_SUBJECTS = [
  "Unable to reset password",
  "Invoice PDF download fails",
  "Double charge on subscription",
  "SSO login redirect loop",
  "API rate limit unexpected 429",
  "Shipping address cannot be updated",
  "Webhook delivery delays",
  "Mobile app crash on checkout",
  "Missing items in latest order",
  "Request to export account data",
];

const personName = (i) => ({
  first: FIRST[i % FIRST.length],
  last: LAST[(i * 3) % LAST.length],
});
const fullName = (n) => `${n.first} ${n.last}`;
const emailOf = (n, domain) =>
  `${n.first}.${n.last}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${domain}`;

const currencyForCountry = (code) => {
  if (code === "GB") return "GBP";
  if (code === "DE") return "EUR";
  if (code === "IN") return "INR";
  if (code === "SG") return "SGD";
  if (code === "JP") return "JPY";
  return "USD";
};

const skuImages = (sku, name) => ({
  thumbnail: ph(200, 200, sku),
  image: ph(600, 400, name),
  images: [
    ph(600, 400, `${sku}-1`),
    ph(600, 400, `${sku}-2`),
    ph(800, 600, `${sku}-detail`),
  ],
});

function writeJson(filename, data) {
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { file: filename, count: data.length, fields: Object.keys(data[0] || {}).length };
}

// --- Base entities ------------------------------------------------------------

const companies = Array.from({ length: counts.companies }, (_, i) => {
  const loc = COUNTRIES[i % COUNTRIES.length];
  const industry = INDUSTRIES[i % INDUSTRIES.length];
  const name = `${LAST[i % LAST.length]} ${["Labs", "Systems", "Group", "Works", "Digital"][i % 5]}`;
  const slug = name.toLowerCase().replace(/\s+/g, "");
  return {
    id: `org_${pad(i + 1)}`,
    name,
    legalName: `${name} ${loc.code === "US" ? "Inc." : "Ltd."}`,
    tradingName: name,
    industry,
    naicsCode: String(511200 + (i % 80)),
    size: pick(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]),
    employeeCount: int(8, 4200),
    annualRevenue: money(250000, 85000000, 0),
    currency: currencyForCountry(loc.code),
    website: `https://www.${slug}.example`,
    email: `hello@${slug}.example`,
    phone: `+1-555-${pad(1000 + i, 4)}`,
    fax: i % 3 === 0 ? `+1-555-${pad(1100 + i, 4)}` : null,
    taxId: `${loc.code}${pad(100000000 + i, 9)}`,
    vatNumber: loc.code === "GB" || loc.code === "DE" ? `${loc.code}${pad(200000000 + i, 9)}` : null,
    dunsNumber: String(100000000 + i),
    logo: ph(200, 200, name.slice(0, 12)),
    coverImage: ph(1200, 400, `${name} HQ`),
    hq: {
      country: loc.code,
      region: loc.region,
      city: loc.city,
      addressLine1: `${100 + i} Market Street`,
      addressLine2: i % 2 === 0 ? `Floor ${(i % 12) + 1}` : null,
      postalCode: String(10000 + i),
      timezone: loc.tz,
      geo: {
        lat: Number((40 - (i % 70) + rand()).toFixed(5)),
        lng: Number((-70 + (i % 140) + rand()).toFixed(5)),
      },
    },
    social: {
      linkedin: `https://linkedin.com/company/${slug}`,
      twitter: `https://x.com/${slug}`,
      facebook: null,
    },
    foundedYear: 1995 + (i % 30),
    status: pick(["active", "active", "active", "inactive"]),
    tags: pick([["enterprise"], ["smb"], ["partner"], ["strategic"], []]),
    metadata: { accountOwnerId: `emp_${pad((i % 5) + 1)}`, tier: pick(["A", "B", "C"]) },
    createdAt: iso(400 - i, 9),
    updatedAt: iso(30 - (i % 30), 11),
  };
});

const customers = Array.from({ length: counts.customers }, (_, i) => {
  const n = personName(i);
  const company = companies[i % companies.length];
  const loc = COUNTRIES[(i + 2) % COUNTRIES.length];
  const isBiz = i % 4 === 0;
  return {
    id: `cus_${pad(i + 1)}`,
    type: isBiz ? "business" : "individual",
    title: pick(["Mr", "Ms", "Mx", null]),
    firstName: n.first,
    lastName: n.last,
    name: fullName(n),
    email: emailOf(n, "example.com"),
    phone: `+1-555-${pad(2000 + i, 4)}`,
    mobile: `+1-555-${pad(2100 + i, 4)}`,
    avatar: ph(128, 128, n.first[0] + n.last[0]),
    companyId: isBiz ? company.id : null,
    companyName: isBiz ? company.name : null,
    jobTitle: isBiz ? pick(JOB_TITLES) : null,
    billingAddress: {
      country: loc.code,
      region: loc.region,
      city: loc.city,
      line1: `${200 + i} Cedar Ave`,
      line2: i % 3 === 0 ? `Apt ${10 + i}` : null,
      postalCode: String(20000 + i),
    },
    shippingAddress: {
      country: loc.code,
      region: loc.region,
      city: loc.city,
      line1: `${200 + i} Cedar Ave`,
      line2: i % 3 === 0 ? `Apt ${10 + i}` : null,
      postalCode: String(20000 + i),
    },
    currency: CURRENCIES[i % CURRENCIES.length],
    preferredLanguage: LANGUAGES[i % LANGUAGES.length],
    timezone: loc.tz,
    loyaltyTier: pick(["bronze", "silver", "gold", "platinum", null]),
    lifetimeValue: money(50, 25000, 2),
    orderCount: int(0, 48),
    marketingOptIn: i % 3 !== 0,
    taxExempt: i % 11 === 0,
    defaultPaymentMethod: {
      type: pick(["card", "card", "bank_transfer", "wallet"]),
      brand: pick(["visa", "mastercard", "amex", null]),
      last4: String(1000 + (i % 9000)),
    },
    status: pick(["active", "active", "active", "blocked"]),
    tags: pick([["vip"], ["retail"], ["wholesale"], ["trial"], []]),
    notes: i % 7 === 0 ? "Prefers email over phone." : null,
    metadata: { source: pick(["web", "referral", "ads", "import"]), segment: pick(["B2C", "B2B"]) },
    createdAt: iso(350 - i, 10),
    updatedAt: iso(20 - (i % 20), 15),
    lastLoginAt: iso(int(0, 40), int(8, 20)),
  };
});

const employees = Array.from({ length: counts.employees }, (_, i) => {
  const n = personName(i + 7);
  const company = companies[i % companies.length];
  const loc = company.hq;
  const managerId = i > 0 && i % 5 !== 0 ? `emp_${pad((i % 5) + 1)}` : null;
  return {
    id: `emp_${pad(i + 1)}`,
    employeeNumber: `E-${10000 + i}`,
    firstName: n.first,
    lastName: n.last,
    displayName: fullName(n),
    email: emailOf(n, "praxis.dev"),
    personalEmail: emailOf(n, "example.com"),
    phone: `+1-555-${pad(3000 + i, 4)}`,
    avatar: ph(128, 128, n.first[0] + n.last[0]),
    jobTitle: JOB_TITLES[i % JOB_TITLES.length],
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    costCenter: `CC-${pad((i % 8) + 1, 3)}`,
    employmentType: pick(["full_time", "full_time", "part_time", "contractor"]),
    status: pick(["active", "active", "active", "on_leave", "terminated"]),
    companyId: company.id,
    managerId,
    location: {
      country: loc.country,
      region: loc.region,
      city: loc.city,
      office: `${loc.city} Office`,
      remote: i % 3 === 0,
      timezone: loc.timezone,
    },
    workSchedule: {
      days: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "09:00",
      endTime: "17:30",
    },
    skills: pick([
      ["javascript", "node", "postgres"],
      ["sales", "negotiation"],
      ["support", "zendesk"],
      ["finance", "excel"],
      ["people", "recruiting"],
    ]),
    hireDate: iso(800 - i * 3, 8).slice(0, 10),
    terminationDate: null,
    probationEndDate: iso(700 - i * 3, 8).slice(0, 10),
    salary: {
      amount: money(45000, 180000, 0),
      currency: company.hq.country === "IN" ? "INR" : "USD",
      interval: "yearly",
      payGrade: pick(["L3", "L4", "L5", "L6"]),
    },
    emergencyContact: {
      name: `${pick(FIRST)} ${pick(LAST)}`,
      relationship: pick(["spouse", "parent", "sibling", "friend"]),
      phone: `+1-555-${pad(4000 + i, 4)}`,
    },
    createdAt: iso(700 - i, 8),
    updatedAt: iso(10 - (i % 10), 12),
  };
});

const inventory = Array.from({ length: counts.inventory }, (_, i) => {
  const product = SKUS[i % SKUS.length];
  const warehouse = WAREHOUSES[i % WAREHOUSES.length];
  const supplier = SUPPLIERS[i % SUPPLIERS.length];
  const onHand = int(0, 800);
  const reserved = Math.min(onHand, int(0, 80));
  const incoming = int(0, 120);
  const available = onHand - reserved;
  let status = "in_stock";
  if (onHand === 0) status = "out_of_stock";
  else if (available <= 50) status = "low_stock";
  if (i % 17 === 0) status = "discontinued";
  const images = skuImages(product.sku, product.name);

  return {
    id: `inv_${pad(i + 1)}`,
    sku: product.sku,
    name: product.name,
    description: product.description,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    thumbnail: images.thumbnail,
    image: images.image,
    images: images.images,
    warehouse: {
      ...warehouse,
      address: {
        line1: `${50 + i} Logistics Park`,
        city: warehouse.name.replace(" FC", ""),
        region: warehouse.region,
        country: warehouse.country,
        postalCode: String(30000 + i),
      },
    },
    supplier: {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      country: supplier.country,
      leadTimeDays: int(3, 28),
    },
    quantityOnHand: onHand,
    quantityReserved: reserved,
    quantityAvailable: available,
    quantityIncoming: incoming,
    quantityDamaged: int(0, 5),
    reorderPoint: 50,
    reorderQuantity: 200,
    safetyStock: 25,
    maxStock: 1000,
    unitCost: product.unitCost,
    listPrice: product.listPrice,
    currency: currencyForCountry(warehouse.country),
    uom: product.uom,
    abcClass: pick(["A", "B", "C"]),
    lotTracking: i % 4 === 0,
    serialTracking: product.category === "electronics" && i % 3 === 0,
    batchNumber: i % 4 === 0 ? `LOT-2026-${pad(i + 1)}` : null,
    expiryDate: product.category === "office" ? iso(-(180 + i), 0).slice(0, 10) : null,
    location: {
      zone: pick(["BULK", "PICK", "COLD", "HAZMAT", "RETURNS"]),
      aisle: String.fromCharCode(65 + (i % 6)),
      rack: String(1 + (i % 20)),
      shelf: String(1 + (i % 6)),
      bin: `${String.fromCharCode(65 + (i % 4))}${1 + (i % 8)}`,
    },
    weight: {
      value: product.weightKg,
      unit: "kg",
    },
    dimensions: {
      ...product.dimensionsCm,
      unit: "cm",
    },
    barcode: `0${pad(890000000000 + i, 12)}`,
    gtin: `00${pad(890000000000 + i, 12)}`,
    hsCode: String(84716000 + (i % 50)),
    countryOfOrigin: pick(["CN", "US", "DE", "IN", "VN", "TW"]),
    status,
    condition: pick(["new", "new", "refurbished", "used"]),
    lastRestockedAt: iso(60 - (i % 60), 7),
    lastCountedAt: iso(20 - (i % 20), 6),
    nextCountDueAt: iso(-(15 + (i % 30)), 6),
    createdAt: iso(200 - (i % 200), 8),
    updatedAt: iso(5 - (i % 5), 16),
  };
});

const orders = Array.from({ length: counts.orders }, (_, i) => {
  const customer = customers[i % customers.length];
  const lineCount = 1 + (i % 3);
  const lineItems = Array.from({ length: lineCount }, (_, li) => {
    const product = SKUS[(i + li) % SKUS.length];
    const quantity = 1 + ((i + li) % 4);
    const unitPrice = product.listPrice;
    const discountAmount = i % 5 === 0 ? Number((unitPrice * 0.1).toFixed(2)) : 0;
    const images = skuImages(product.sku, product.name);
    return {
      id: `oli_${pad(i + 1)}_${li + 1}`,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      description: product.description,
      thumbnail: images.thumbnail,
      image: images.image,
      quantity,
      uom: product.uom,
      unitPrice,
      discountAmount,
      currency: customer.currency,
      taxRate: 0.08,
      taxAmount: Number(((unitPrice - discountAmount) * quantity * 0.08).toFixed(2)),
      lineTotal: Number(((unitPrice - discountAmount) * quantity).toFixed(2)),
      fulfillmentStatus: pick(["unfulfilled", "partial", "fulfilled"]),
      warehouseId: WAREHOUSES[(i + li) % WAREHOUSES.length].id,
    };
  });
  const subtotal = Number(lineItems.reduce((s, li) => s + li.lineTotal, 0).toFixed(2));
  const discount = Number(lineItems.reduce((s, li) => s + li.discountAmount * li.quantity, 0).toFixed(2));
  const tax = Number(lineItems.reduce((s, li) => s + li.taxAmount, 0).toFixed(2));
  const shipping = money(0, 25);
  const total = Number((subtotal + tax + shipping).toFixed(2));
  const status = pick([
    "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded",
  ]);

  return {
    id: `ord_${pad(i + 1)}`,
    number: `ORD-2026-${pad(1000 + i, 5)}`,
    status,
    paymentStatus: pick(["unpaid", "paid", "paid", "partially_refunded", "refunded"]),
    fulfillmentStatus: pick(["unfulfilled", "partial", "fulfilled", "returned"]),
    currency: customer.currency,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      avatar: customer.avatar,
    },
    companyId: customer.companyId,
    billingAddress: customer.billingAddress,
    shippingAddress: customer.shippingAddress,
    lineItems,
    totals: {
      subtotal,
      discount,
      shipping,
      tax,
      total,
      amountPaid: status === "refunded" ? 0 : pick([0, total, total]),
      amountRefunded: status === "refunded" ? total : 0,
    },
    // flat mirrors for simpler clients
    subtotal,
    tax,
    shipping,
    discount,
    total,
    couponCode: i % 5 === 0 ? pick(["SAVE10", "WELCOME15", "FREESHIP"]) : null,
    shippingMethod: pick(["standard", "express", "overnight", "pickup"]),
    shippingCarrier: pick(["UPS", "FedEx", "DHL", null]),
    channel: pick(["web", "mobile", "pos", "api", "marketplace"]),
    source: pick(["direct", "google", "facebook", "affiliate", "email"]),
    riskScore: int(0, 100),
    ipAddress: `203.0.113.${(i % 250) + 1}`,
    userAgent: pick([
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
      "PraxisApp/2.4.1 (iOS)",
    ]),
    giftMessage: i % 8 === 0 ? "Happy birthday!" : null,
    notes: i % 5 === 0 ? "Gift wrap requested" : null,
    tags: pick([["priority"], ["wholesale"], ["first-order"], []]),
    metadata: { storeId: `store_${pad((i % 4) + 1, 2)}`, salespersonId: employees[i % employees.length].id },
    placedAt: iso(90 - (i % 90), 14),
    confirmedAt: status === "pending" ? null : iso(89 - (i % 89), 15),
    shippedAt: ["shipped", "delivered"].includes(status) ? iso(80 - (i % 80), 11) : null,
    deliveredAt: status === "delivered" ? iso(75 - (i % 75), 16) : null,
    cancelledAt: status === "cancelled" ? iso(85 - (i % 85), 12) : null,
    createdAt: iso(90 - (i % 90), 14),
    updatedAt: iso(15 - (i % 15), 18),
  };
});

const supportTickets = Array.from({ length: counts["support-ticket"] }, (_, i) => {
  const customer = customers[i % customers.length];
  const assignee = employees[(i + 3) % employees.length];
  const requesterEmp = employees[i % employees.length];
  const company = companies[i % companies.length];
  const status = pick(["open", "pending", "hold", "solved", "closed"]);
  const createdDays = 120 - (i % 120);
  const updatedDays = Math.max(0, createdDays - int(0, 10));
  const firstResponseDays = Math.max(0, createdDays - int(0, 2));
  const resolvedAt =
    status === "solved" || status === "closed" ? iso(updatedDays, 17) : null;
  const hasAttachment = i % 3 === 0;

  return {
    id: `TCK-${1000 + i}`,
    number: 1000 + i,
    subject: TICKET_SUBJECTS[i % TICKET_SUBJECTS.length],
    description: `Customer reported: ${TICKET_SUBJECTS[i % TICKET_SUBJECTS.length].toLowerCase()}. Steps to reproduce and account context attached.`,
    status,
    priority: pick(["low", "normal", "normal", "high", "urgent"]),
    type: pick(["question", "incident", "problem", "task"]),
    channel: pick(["email", "chat", "phone", "web", "api"]),
    language: LANGUAGES[i % LANGUAGES.length],
    requester: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
      phone: customer.phone,
    },
    assignee: {
      id: assignee.id,
      name: `${assignee.firstName} ${assignee.lastName}`,
      email: assignee.email,
      avatar: assignee.avatar,
    },
    group: {
      id: `grp_${pad((i % 4) + 1, 2)}`,
      name: pick(["Tier 1 Support", "Billing", "Technical", "Success"]),
    },
    organization: {
      id: company.id,
      name: company.name,
      logo: company.logo,
    },
    relatedOrderId: i % 2 === 0 ? orders[i % orders.length].id : null,
    tags: pick([
      ["auth", "password"],
      ["billing"],
      ["shipping", "orders"],
      ["api", "rate-limit"],
      ["mobile"],
      ["export", "gdpr"],
    ]),
    customFields: {
      productArea: pick(["auth", "billing", "shipping", "api", "mobile"]),
      severity: pick(["S1", "S2", "S3", "S4"]),
      environment: pick(["production", "staging"]),
    },
    attachments: hasAttachment
      ? [
          {
            id: `att_${pad(i + 1)}_1`,
            fileName: `screenshot-${i + 1}.png`,
            contentType: "image/png",
            sizeBytes: int(20_000, 900_000),
            url: ph(800, 600, `ticket-${1000 + i}`),
          },
          {
            id: `att_${pad(i + 1)}_2`,
            fileName: `logs-${i + 1}.txt`,
            contentType: "text/plain",
            sizeBytes: int(1_000, 40_000),
            url: ph(400, 200, "log-file"),
          },
        ]
      : [],
    metrics: {
      replyCount: int(0, 12),
      reopens: int(0, 3),
      agentWaitMinutes: int(0, 480),
      requesterWaitMinutes: int(0, 1440),
    },
    satisfaction: {
      score: status === "solved" || status === "closed" ? pick([null, 1, 2, 3, 4, 5]) : null,
      rating:
        status === "solved" || status === "closed"
          ? pick([null, "offered", "good", "bad"])
          : null,
      comment: i % 9 === 0 ? "Agent resolved it quickly." : null,
    },
    // legacy flat field kept for simple filters
    satisfactionRating:
      status === "solved" || status === "closed"
        ? pick([null, "offered", "good", "bad"])
        : null,
    isEscalated: i % 7 === 0,
    isPublic: true,
    dueAt: iso(Math.max(0, createdDays - 2), 18),
    firstResponseAt: iso(firstResponseDays, 11),
    createdAt: iso(createdDays, 9),
    updatedAt: iso(updatedDays, 16),
    resolvedAt,
    closedAt: status === "closed" ? resolvedAt : null,
    createdBy: {
      id: requesterEmp.id,
      name: `${requesterEmp.firstName} ${requesterEmp.lastName}`,
    },
  };
});

const invoices = Array.from({ length: counts.invoices }, (_, i) => {
  const customer = customers[i % customers.length];
  const company = companies[i % companies.length];
  const lineCount = 1 + (i % 3);
  const lineItems = Array.from({ length: lineCount }, (_, li) => {
    const product = SKUS[(i + li) % SKUS.length];
    const quantity = 1 + ((i + li) % 5);
    const unitPrice = product.listPrice;
    const images = skuImages(product.sku, product.name);
    return {
      id: `ili_${pad(i + 1)}_${li + 1}`,
      description: product.name,
      sku: product.sku,
      thumbnail: images.thumbnail,
      quantity,
      uom: product.uom,
      unitPrice,
      amount: Number((quantity * unitPrice).toFixed(2)),
    };
  });
  const subtotal = Number(lineItems.reduce((s, li) => s + li.amount, 0).toFixed(2));
  const tax = Number((subtotal * 0.1).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const status = pick(["draft", "open", "paid", "paid", "void", "uncollectible"]);

  return {
    id: `invc_${pad(i + 1)}`,
    number: `INV-2026-${pad(5000 + i, 5)}`,
    status,
    currency: customer.currency,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
    },
    companyId: company.id,
    companySnapshot: {
      id: company.id,
      name: company.name,
      logo: company.logo,
      taxId: company.taxId,
      address: company.hq,
    },
    purchaseOrderNumber: i % 3 === 0 ? `PO-${pad(7000 + i, 5)}` : null,
    paymentTerms: pick(["due_on_receipt", "net_15", "net_30", "net_45"]),
    memo: i % 4 === 0 ? "Thank you for your business." : null,
    lineItems,
    subtotal,
    tax,
    taxRate: 0.1,
    total,
    amountDue: status === "paid" || status === "void" ? 0 : total,
    amountPaid: status === "paid" ? total : 0,
    pdfUrl: ph(600, 800, `INV-${5000 + i}`),
    hostedInvoiceUrl: `https://billing.example/invoices/invc_${pad(i + 1)}`,
    issuedAt: iso(100 - (i % 100), 10),
    dueAt: iso(70 - (i % 70), 10),
    paidAt: status === "paid" ? iso(60 - (i % 60), 12) : null,
    voidedAt: status === "void" ? iso(50 - (i % 50), 12) : null,
    createdAt: iso(100 - (i % 100), 10),
    updatedAt: iso(20 - (i % 20), 13),
  };
});

const shipments = Array.from({ length: counts.shipments }, (_, i) => {
  const order = orders[i % orders.length];
  const warehouse = WAREHOUSES[i % WAREHOUSES.length];
  const status = pick([
    "label_created", "picked_up", "in_transit", "out_for_delivery", "delivered", "exception", "returned",
  ]);
  const trackingNumber = `1Z${pad(999999999999 + i, 12)}`;
  const carrier = pick(["UPS", "FedEx", "DHL", "USPS", "BlueDart"]);

  return {
    id: `shp_${pad(i + 1)}`,
    orderId: order.id,
    orderNumber: order.number,
    trackingNumber,
    trackingUrl: `https://track.example/${carrier.toLowerCase()}/${trackingNumber}`,
    labelUrl: ph(400, 600, `LABEL-${i + 1}`),
    carrier,
    serviceLevel: pick(["standard", "express", "overnight"]),
    status,
    origin: {
      warehouseId: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      country: warehouse.country,
      city: warehouse.name,
      address: {
        line1: `${50 + i} Logistics Park`,
        region: warehouse.region,
        country: warehouse.country,
        postalCode: String(30000 + i),
      },
    },
    destination: order.shippingAddress,
    packages: [
      {
        id: `pkg_${pad(i + 1)}_1`,
        trackingNumber: `${trackingNumber}-1`,
        weightKg: money(0.2, 12, 2),
        dimensionsCm: {
          length: int(10, 60),
          width: int(8, 40),
          height: int(5, 30),
        },
        items: order.lineItems.slice(0, 1).map((li) => ({
          sku: li.sku,
          name: li.name,
          quantity: li.quantity,
          image: li.image,
        })),
      },
    ],
    events: [
      {
        status: "label_created",
        description: "Shipping label created",
        location: warehouse.name,
        occurredAt: iso(20 - (i % 20), 9),
      },
      {
        status: "picked_up",
        description: "Picked up by carrier",
        location: warehouse.name,
        occurredAt: iso(19 - (i % 19), 14),
      },
      {
        status: status === "label_created" ? "label_created" : status,
        description: `Shipment is ${status.replaceAll("_", " ")}`,
        location: order.shippingAddress.city,
        occurredAt: iso(Math.max(0, 10 - (i % 10)), 16),
      },
    ],
    estimatedDeliveryAt: iso(Math.max(0, 10 - (i % 10)), 18),
    shippedAt: iso(20 - (i % 20), 11),
    deliveredAt: status === "delivered" ? iso(Math.max(0, 5 - (i % 5)), 15) : null,
    signedBy: status === "delivered" ? pick(FIRST) : null,
    proofOfDeliveryUrl: status === "delivered" ? ph(600, 400, `POD-${i + 1}`) : null,
    createdAt: iso(20 - (i % 20), 9),
    updatedAt: iso(3 - (i % 3), 19),
  };
});

const transactions = Array.from({ length: counts.transactions }, (_, i) => {
  const order = orders[i % orders.length];
  const invoice = invoices[i % invoices.length];
  const type = pick(["payment", "payment", "refund", "authorization", "capture"]);
  const status = pick(["pending", "succeeded", "succeeded", "failed", "canceled"]);

  return {
    id: `txn_${pad(i + 1)}`,
    type,
    status,
    amount: type === "refund" ? money(5, 80) : order.total,
    fee: status === "succeeded" ? money(0.3, 4.5) : 0,
    net: null,
    currency: order.currency,
    paymentMethod: {
      type: pick(["card", "card", "bank_transfer", "wallet", "cod"]),
      brand: pick(["visa", "mastercard", "amex", null]),
      last4: String(1000 + (i % 9000)),
      expMonth: int(1, 12),
      expYear: 2027 + (i % 5),
      wallet: pick([null, null, "apple_pay", "google_pay"]),
    },
    orderId: order.id,
    invoiceId: invoice.id,
    customerId: order.customer.id,
    customer: order.customer,
    provider: pick(["stripe", "razorpay", "paypal", "adyen"]),
    providerReference: `pi_${pad(900000 + i, 8)}`,
    authorizationCode: status === "succeeded" ? `AUTH${pad(i + 1, 6)}` : null,
    receiptUrl: status === "succeeded" ? ph(600, 800, `RCPT-${i + 1}`) : null,
    statementDescriptor: "PRAXIS*ORDER",
    riskScore: int(0, 100),
    threeDSecure: pick(["authenticated", "attempted", "not_supported", null]),
    failureCode: status === "failed" ? pick(["card_declined", "insufficient_funds", "expired_card"]) : null,
    failureMessage: status === "failed" ? "The card was declined by the issuer." : null,
    billingAddress: order.billingAddress,
    metadata: { ipAddress: order.ipAddress, channel: order.channel },
    createdAt: iso(85 - (i % 85), 14),
    updatedAt: iso(12 - (i % 12), 14),
    capturedAt: ["payment", "capture"].includes(type) && status === "succeeded"
      ? iso(84 - (i % 84), 14)
      : null,
  };
}).map((txn) => ({
  ...txn,
  net: Number((txn.amount - (txn.fee || 0)).toFixed(2)),
}));

const projects = Array.from({ length: counts.projects }, (_, i) => {
  const company = companies[i % companies.length];
  const owner = employees[i % employees.length];
  const status = pick(["planned", "active", "active", "on_hold", "completed", "cancelled"]);
  const members = [0, 1, 2].map((offset) => {
    const emp = employees[(i + offset) % employees.length];
    return {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      avatar: emp.avatar,
      role: offset === 0 ? "owner" : pick(["contributor", "reviewer", "viewer"]),
    };
  });

  return {
    id: `prj_${pad(i + 1)}`,
    key: `PRJ-${pad(i + 1, 3)}`,
    name: `${pick(["Platform", "Mobile", "Checkout", "Analytics", "Infra", "Support"])} ${pick(["Revamp", "Launch", "Migration", "Stabilization"])}`,
    description: "Cross-functional initiative tracked for delivery demos and integrations.",
    status,
    priority: pick(["low", "medium", "high", "critical"]),
    progressPercent: status === "completed" ? 100 : int(0, 95),
    companyId: company.id,
    company: { id: company.id, name: company.name, logo: company.logo },
    owner: {
      id: owner.id,
      name: `${owner.firstName} ${owner.lastName}`,
      email: owner.email,
      avatar: owner.avatar,
    },
    members,
    budget: {
      amount: money(5000, 250000, 0),
      currency: company.currency,
      spent: money(500, 180000, 0),
    },
    coverImage: ph(1200, 400, `PRJ-${pad(i + 1, 3)}`),
    startDate: iso(200 - (i % 200), 8).slice(0, 10),
    targetDate: iso(Math.max(0, 40 - (i % 40)), 8).slice(0, 10),
    completedAt: status === "completed" ? iso(Math.max(0, 20 - (i % 20)), 17) : null,
    tags: pick([["q1"], ["customer-facing"], ["internal"], ["compliance"], []]),
    links: {
      boardUrl: `https://projects.example/boards/prj_${pad(i + 1)}`,
      docsUrl: `https://docs.example/prj_${pad(i + 1)}`,
    },
    createdAt: iso(220 - (i % 220), 9),
    updatedAt: iso(8 - (i % 8), 11),
  };
});

const subscriptions = Array.from({ length: counts.subscriptions }, (_, i) => {
  const customer = customers[i % customers.length];
  const status = pick(["trialing", "active", "active", "past_due", "canceled", "paused"]);
  const interval = pick(["month", "month", "year"]);
  const unitAmount = interval === "year" ? money(99, 999, 0) : money(9, 99, 0);
  const planId = pick(["starter", "pro", "business", "enterprise"]);

  return {
    id: `sub_${pad(i + 1)}`,
    status,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
    },
    companyId: customer.companyId,
    plan: {
      id: `plan_${planId}`,
      name: planId[0].toUpperCase() + planId.slice(1),
      interval,
      intervalCount: 1,
      currency: customer.currency,
      unitAmount,
      features: pick([
        ["api_access", "email_support"],
        ["api_access", "priority_support", "sso"],
        ["api_access", "priority_support", "sso", "audit_logs"],
      ]),
      image: ph(200, 200, planId),
    },
    quantity: 1 + (i % 5),
    seats: {
      used: 1 + (i % 5),
      included: 5 + (i % 10),
    },
    defaultPaymentMethod: customer.defaultPaymentMethod,
    currentPeriodStart: iso(25 - (i % 25), 0),
    currentPeriodEnd: iso(Math.max(0, 5 - (i % 5)), 0),
    nextInvoice: {
      amount: Number((unitAmount * (1 + (i % 5))).toFixed(2)),
      currency: customer.currency,
      dueAt: iso(Math.max(0, 5 - (i % 5)), 0),
    },
    cancelAtPeriodEnd: status === "canceled" ? true : i % 9 === 0,
    trialEnd: status === "trialing" ? iso(Math.max(0, 10 - (i % 10)), 0) : null,
    createdAt: iso(300 - (i % 300), 10),
    updatedAt: iso(6 - (i % 6), 12),
    canceledAt: status === "canceled" ? iso(4 - (i % 4), 12) : null,
  };
});

const appointments = Array.from({ length: counts.appointments }, (_, i) => {
  const customer = customers[i % customers.length];
  const host = employees[(i + 2) % employees.length];
  const status = pick(["scheduled", "confirmed", "completed", "cancelled", "no_show"]);
  const type = pick(["video", "phone", "in_person"]);
  const startDays = 40 - (i % 40);
  const start = new Date(iso(startDays, 9 + (i % 8), (i * 7) % 60));
  const end = new Date(start.getTime() + (30 + (i % 3) * 15) * 60 * 1000);
  const attendees = [
    {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
      role: "invitee",
      responseStatus: pick(["accepted", "tentative", "needs_action", "declined"]),
    },
    {
      id: host.id,
      name: `${host.firstName} ${host.lastName}`,
      email: host.email,
      avatar: host.avatar,
      role: "host",
      responseStatus: "accepted",
    },
  ];

  return {
    id: `apt_${pad(i + 1)}`,
    title: pick([
      "Product demo",
      "Onboarding call",
      "Support follow-up",
      "Sales discovery",
      "QBR",
      "Implementation workshop",
    ]),
    description: "Scheduled customer-facing meeting with agenda and follow-up notes.",
    status,
    type,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
    },
    host: {
      id: host.id,
      name: `${host.firstName} ${host.lastName}`,
      email: host.email,
      avatar: host.avatar,
    },
    attendees,
    companyId: customer.companyId,
    location:
      type === "in_person"
        ? `${host.location.city}, ${host.location.country}`
        : type === "phone"
          ? "Phone"
          : pick(["Zoom", "Google Meet"]),
    meetingUrl:
      type === "video" ? `https://meet.example/apt_${pad(i + 1)}` : null,
    calendarInviteUrl: ph(400, 200, `ICS-${i + 1}`),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    durationMinutes: Math.round((end - start) / 60000),
    timezone: pick(["UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Singapore"]),
    reminders: [
      { method: "email", minutesBefore: 1440 },
      { method: "popup", minutesBefore: 30 },
    ],
    notes: i % 4 === 0 ? "Send agenda 24h before meeting." : null,
    recordingUrl: status === "completed" && type === "video"
      ? ph(640, 360, `REC-${i + 1}`)
      : null,
    createdAt: iso(startDays + 5, 8),
    updatedAt: iso(Math.max(0, startDays - 1), 9),
  };
});

const results = [
  writeJson("companies.json", companies),
  writeJson("customers.json", customers),
  writeJson("employees.json", employees),
  writeJson("inventory.json", inventory),
  writeJson("orders.json", orders),
  writeJson("support-ticket.json", supportTickets),
  writeJson("invoices.json", invoices),
  writeJson("shipments.json", shipments),
  writeJson("transactions.json", transactions),
  writeJson("projects.json", projects),
  writeJson("subscriptions.json", subscriptions),
  writeJson("appointments.json", appointments),
];

console.log(`Generated tiered world JSON → ${outDir}`);
console.log(
  FORCE_COUNT
    ? `(forced --count=${FORCE_COUNT} for all collections)`
    : "(simple=1000, mid-high=200–300, extreme=100)"
);
for (const r of results) {
  console.log(
    `  ${String(r.count).padStart(4)}  ${String(r.fields).padStart(2)} fields  ${r.file}`
  );
}
console.log("\nNot seeded yet.");
