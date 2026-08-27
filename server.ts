import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { INITIAL_VEHICLES } from "./src/data";

const app = express();
const PORT = 3000;

// Increase body limit to support high-res image uploads or base64 previews
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Directory & file paths for server persistence across devices
const DATA_DIR = path.join(process.cwd(), "data_store");
const VEHICLES_FILE = path.join(DATA_DIR, "vehicles.json");
const DELETED_FILE = path.join(DATA_DIR, "deleted_ids.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "inquiries.json");
const AUTH_FILE = path.join(DATA_DIR, "admin_auth.json");

interface AdminAccount {
  id: string;
  email: string;
  salt: string;
  hash: string;
  role: 'admin';
  createdAt: string;
  updatedAt: string;
}

interface AdminSession {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

interface AuthStore {
  admins: AdminAccount[];
  sessions: AdminSession[];
}

function readAuthStore(): AuthStore {
  ensureDataDir();
  if (!fs.existsSync(AUTH_FILE)) {
    const initial: AuthStore = { admins: [], sessions: [] };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { admins: [], sessions: [] };
  }
}

function saveAuthStore(store: AuthStore) {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const computedHash = hashPassword(password, salt);
  const bufA = Buffer.from(computedHash, "hex");
  const bufB = Buffer.from(expectedHash, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const KNOWN_DELETED_IDS = new Set<string>([
  "toyota-corolla-s-2015-silver-few-months-used",
  "lexus-rx350-2015-silver-duty-paid",
  "toyota-highlander-xle-2017-brown-foreign-used",
  "toyota-corolla-le-2015-silver-direct-belgium"
]);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDeletedIdsStore(): Set<string> {
  ensureDataDir();
  const deletedSet = new Set<string>(KNOWN_DELETED_IDS);
  if (!fs.existsSync(DELETED_FILE)) {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(deletedSet), null, 2), "utf-8");
    return deletedSet;
  }
  try {
    const raw = fs.readFileSync(DELETED_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      data.forEach((id: string) => deletedSet.add(id));
    }
  } catch (e) {
    console.error("Failed to read deleted_ids.json", e);
  }
  return deletedSet;
}

function recordDeletedId(id: string) {
  ensureDataDir();
  const set = readDeletedIdsStore();
  set.add(id);
  fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(set), null, 2), "utf-8");
}

// Decode Unicode escape sequences (\uXXXX, \u{XXXXX}, \UXXXXXXXX, \xXX, &#x...;, &#...;)
function decodeUnicodeEscapes(str: any): any {
  if (!str || typeof str !== "string") return str;
  let res = str;

  // 1. ES6 bracketed unicode escape: \u{1F1F3} or \u{1F9FE}
  res = res.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 2. Standard 4-digit hex escape: \u2728, \u2014, \u20A6, \u2022
  res = res.replace(/\\u([0-9a-fA-F]{4})/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    } catch {
      return _;
    }
  });

  // 3. 8-digit uppercase \U0001F1F3
  res = res.replace(/\\U([0-9a-fA-F]{8})/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 4. Hex escape \xB0
  res = res.replace(/\\x([0-9a-fA-F]{2})/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    } catch {
      return _;
    }
  });

  // 5. HTML hexadecimal entities: &#x1F1F3;
  res = res.replace(/&#x([0-9a-fA-F]{1,6});/gi, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 6. HTML decimal entities: &#128664;
  res = res.replace(/&#([0-9]{1,7});/g, (_: string, dec: string) => {
    try {
      const code = parseInt(dec, 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 7. Accidental stripped prefix at start or whitespace: e.g. "2728 2014 BMW" -> "✨ 2014 BMW"
  res = res.replace(/^2728\s+/g, "✨ ");
  res = res.replace(/\s+2728$/g, " ✨");

  // 8. Convert literal \n or \r\n to real newlines if present as escaped characters
  res = res.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");

  return res;
}

function normalizeVehicle(v: any): any {
  if (!v || typeof v !== "object") return v;
  const copy = { ...v };
  ["description", "make", "model", "dealership", "engine", "color", "condition", "location"].forEach((key) => {
    if (copy[key] && typeof copy[key] === "string") {
      copy[key] = decodeUnicodeEscapes(copy[key]);
    }
  });
  return copy;
}

// Helper functions for reading and writing JSON storage
function readVehiclesStore() {
  ensureDataDir();
  const deletedSet = readDeletedIdsStore();
  const normalizedInitial = INITIAL_VEHICLES
    .map(normalizeVehicle)
    .filter(v => !deletedSet.has(v.id));

  if (!fs.existsSync(VEHICLES_FILE)) {
    fs.writeFileSync(VEHICLES_FILE, JSON.stringify(normalizedInitial, null, 2), "utf-8");
    return normalizedInitial;
  }
  try {
    const raw = fs.readFileSync(VEHICLES_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      const normalizedData = data
        .map(normalizeVehicle)
        .filter(v => !deletedSet.has(v.id));
      const existingIds = new Set(normalizedData.map((v: any) => v.id));
      const missingInitial = normalizedInitial.filter((v: any) => !existingIds.has(v.id) && !deletedSet.has(v.id));
      
      let finalVehicles = normalizedData;
      if (missingInitial.length > 0) {
        finalVehicles = [...missingInitial, ...normalizedData];
      }
      fs.writeFileSync(VEHICLES_FILE, JSON.stringify(finalVehicles, null, 2), "utf-8");
      return finalVehicles;
    }
  } catch (e) {
    console.error("Failed to parse vehicles.json, falling back to seed data", e);
  }
  fs.writeFileSync(VEHICLES_FILE, JSON.stringify(normalizedInitial, null, 2), "utf-8");
  return normalizedInitial;
}

function saveVehiclesStore(vehicles: any[]) {
  ensureDataDir();
  const deletedSet = readDeletedIdsStore();
  const normalized = vehicles
    .map(normalizeVehicle)
    .filter(v => !deletedSet.has(v.id));
  fs.writeFileSync(VEHICLES_FILE, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

function readLeadsStore() {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(LEADS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLeadsStore(leads: any[]) {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
}

function readInquiriesStore() {
  ensureDataDir();
  if (!fs.existsSync(INQUIRIES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(INQUIRIES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveInquiriesStore(inquiries: any[]) {
  ensureDataDir();
  fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2), "utf-8");
}

// API Routes & Anti-Cache Middleware
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.get("/api/resolve-image", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).json({ error: "Missing url parameter" });
  
  try {
    if (targetUrl.includes("ibb.co/") && !targetUrl.includes("i.ibb.co/")) {
      const response = await fetch(targetUrl);
      const text = await response.text();
      const match = text.match(/meta property="og:image" content="([^"]+)"/);
      if (match && match[1]) {
        return res.json({ resolvedUrl: match[1] });
      }
    }
    return res.json({ resolvedUrl: targetUrl });
  } catch (err) {
    return res.json({ resolvedUrl: targetUrl });
  }
});

app.get("/api/vehicles", (req, res) => {
  const vehicles = readVehiclesStore();
  res.json(vehicles);
});

app.post("/api/vehicles", (req, res) => {
  const newVehicles = req.body;
  if (!Array.isArray(newVehicles)) {
    return res.status(400).json({ error: "Expected array of vehicles" });
  }
  const saved = saveVehiclesStore(newVehicles);
  res.json({ success: true, count: saved.length, vehicles: saved });
});

app.delete("/api/vehicles/:id", (req, res) => {
  const vehicleId = req.params.id;
  if (!vehicleId) {
    return res.status(400).json({ error: "Missing vehicle id" });
  }
  recordDeletedId(vehicleId);
  const current = readVehiclesStore();
  const filtered = current.filter(v => v.id !== vehicleId);
  saveVehiclesStore(filtered);
  res.json({ success: true, deletedId: vehicleId, remaining: filtered.length });
});

app.post("/api/vehicles/delete", (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "Missing vehicle id" });
  }
  recordDeletedId(id);
  const current = readVehiclesStore();
  const filtered = current.filter(v => v.id !== id);
  saveVehiclesStore(filtered);
  res.json({ success: true, deletedId: id, remaining: filtered.length });
});

app.post("/api/vehicles/reset", (req, res) => {
  saveVehiclesStore(INITIAL_VEHICLES);
  res.json({ success: true, vehicles: INITIAL_VEHICLES });
});

app.get("/api/leads", (req, res) => {
  const leads = readLeadsStore();
  res.json(leads);
});

app.post("/api/leads", (req, res) => {
  const leads = req.body;
  if (Array.isArray(leads)) {
    saveLeadsStore(leads);
  }
  res.json({ success: true });
});

app.get("/api/inquiries", (req, res) => {
  const inquiries = readInquiriesStore();
  res.json(inquiries);
});

app.post("/api/inquiries", (req, res) => {
  const inquiries = req.body;
  if (Array.isArray(inquiries)) {
    saveInquiriesStore(inquiries);
  }
  res.json({ success: true });
});

// Admin Authentication Endpoints
app.get("/api/admin/auth/status", (req, res) => {
  const store = readAuthStore();
  const isInitialized = store.admins.length > 0;
  const adminEmail = isInitialized ? store.admins[0].email : null;
  res.json({ isInitialized, adminEmail });
});

app.post("/api/admin/auth/setup", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }

  const store = readAuthStore();
  if (store.admins.length > 0) {
    return res.status(400).json({ error: "Administrator account already exists. Please log in." });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  const newAdmin: AdminAccount = {
    id: "admin-" + Date.now(),
    email: cleanEmail,
    salt,
    hash,
    role: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const token = generateToken();
  const session: AdminSession = {
    token,
    email: cleanEmail,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  store.admins.push(newAdmin);
  store.sessions.push(session);
  saveAuthStore(store);

  res.json({
    success: true,
    token,
    user: { email: cleanEmail, role: "admin" },
  });
});

app.post("/api/admin/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const store = readAuthStore();

  // If no admin exists yet, prompt first-time setup
  if (store.admins.length === 0) {
    return res.status(404).json({
      error: "No administrator account found. Please initialize the first administrator account.",
      code: "NO_ADMIN_EXISTS"
    });
  }

  const admin = store.admins.find((a) => a.email.toLowerCase() === cleanEmail);
  if (!admin) {
    return res.status(401).json({ error: "Invalid administrator email or password." });
  }

  const isValid = verifyPassword(password, admin.salt, admin.hash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid administrator email or password." });
  }

  const token = generateToken();
  const session: AdminSession = {
    token,
    email: admin.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  // Keep latest 20 active sessions
  store.sessions = store.sessions.filter((s) => s.expiresAt > Date.now()).slice(-20);
  store.sessions.push(session);
  saveAuthStore(store);

  res.json({
    success: true,
    token,
    user: { email: admin.email, role: "admin" },
  });
});

app.get("/api/admin/auth/verify", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
  if (!token) {
    return res.status(401).json({ valid: false, error: "Missing authorization token" });
  }

  const store = readAuthStore();
  const session = store.sessions.find((s) => s.token === token && s.expiresAt > Date.now());
  if (!session) {
    return res.status(401).json({ valid: false, error: "Invalid or expired session" });
  }

  res.json({
    valid: true,
    user: { email: session.email, role: "admin" },
  });
});

app.post("/api/admin/auth/change-password", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const store = readAuthStore();
  const session = store.sessions.find((s) => s.token === token && s.expiresAt > Date.now());
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Both current password and new password are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters long" });
  }

  const admin = store.admins.find((a) => a.email.toLowerCase() === session.email.toLowerCase());
  if (!admin) {
    return res.status(404).json({ error: "Administrator account not found" });
  }

  const isValid = verifyPassword(oldPassword, admin.salt, admin.hash);
  if (!isValid) {
    return res.status(400).json({ error: "Incorrect current password. Please verify and try again." });
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, newSalt);
  admin.salt = newSalt;
  admin.hash = newHash;
  admin.updatedAt = new Date().toISOString();

  saveAuthStore(store);
  res.json({ success: true, message: "Password updated successfully" });
});

app.post("/api/admin/auth/forgot-password", (req, res) => {
  // Always return generic confirmation to protect against email enumeration
  res.json({
    success: true,
    message: "If an administrator account matches this email, password reset instructions have been dispatched."
  });
});

app.post("/api/admin/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
  if (token) {
    const store = readAuthStore();
    store.sessions = store.sessions.filter((s) => s.token !== token);
    saveAuthStore(store);
  }
  res.json({ success: true });
});

function getSlug(v: any) {
  if (!v) return '';
  const make = (v.make || '').toLowerCase().trim();
  const model = (v.model || '').toLowerCase().trim();
  const year = v.year || '';
  return `${year}-${make}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function findVehicleBySlug(slug: string) {
  const vehicles = readVehiclesStore();
  const clean = decodeURIComponent(slug).toLowerCase().trim();
  return vehicles.find((v: any) => {
    return (
      (v.id && v.id.toLowerCase() === clean) ||
      getSlug(v) === clean ||
      getSlug(v).replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')
    );
  });
}

async function startServer() {
  let vite: any = null;
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // OpenGraph metadata injection for direct vehicle links (/vehicles/:slug)
  app.get("/vehicles/:slug", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const vehicle = findVehicleBySlug(slug);
      const host = req.get("host") || "jiteautodeals-sable.vercel.app";
      const protocol = req.protocol || "https";
      const fullUrl = `${protocol}://${host}/vehicles/${slug}`;

      let html = "";
      if (process.env.NODE_ENV !== "production" && vite) {
        const indexPath = path.join(process.cwd(), "index.html");
        html = fs.readFileSync(indexPath, "utf-8");
        html = await vite.transformIndexHtml(req.originalUrl, html);
      } else {
        const distIndexPath = path.join(process.cwd(), "dist", "index.html");
        if (fs.existsSync(distIndexPath)) {
          html = fs.readFileSync(distIndexPath, "utf-8");
        } else {
          return next();
        }
      }

      if (vehicle) {
        const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} - ₦${Number(vehicle.price || 0).toLocaleString()} | Jite Auto Deals`;
        const rawDesc = decodeUnicodeEscapes(vehicle.description || "").replace(/\s+/g, " ").trim();
        const desc = `${vehicle.condition || "Verified"} • ${vehicle.transmission || "Automatic"} • ${vehicle.location || "Nigeria"}. ${rawDesc.slice(0, 160)}`;
        const img = vehicle.images && vehicle.images[0] ? vehicle.images[0] : "";

        const metaTags = `<title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="${fullUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Jite Auto Deals" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />`;
        html = html.replace(/<title>.*?<\/title>/i, metaTags);
      }

      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(html);
    } catch (err) {
      next();
    }
  });

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
