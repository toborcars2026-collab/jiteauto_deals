import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { resolveRouteMetadata, injectMetadataIntoHtml } from "./src/metaHelper";
import {
  getAdminAuthConfig,
  saveAdminAuthConfig,
  clearAdminAuthConfig
} from "./api/_authHelper";
import adminAuthHandler from "./api/admin-auth";

const app = express();
const PORT = 3000;

app.use(cookieParser());
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

interface MasterPasswordConfig {
  salt: string;
  hash: string;
  updatedAt: string;
}

interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
}

interface AuthStore {
  passwordConfig: MasterPasswordConfig | null;
  sessions: AdminSession[];
}

// In-memory rate limiting for brute-force protection
interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttempt>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown-ip";
}

function checkRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt) return { allowed: true };

  // If locked out
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Reset window if 5 minutes elapsed
  if (now - attempt.firstAttempt > 5 * 60 * 1000) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (attempt.count >= 5) {
    attempt.lockedUntil = now + 5 * 60 * 1000; // 5 minutes lockout
    const waitSeconds = 300;
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  attempt.count += 1;
  loginAttempts.set(ip, attempt);
}

function resetRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const variants = [password, password.trim()];
  for (const variant of variants) {
    const computedHash = hashPassword(variant, salt);
    const bufA = Buffer.from(computedHash, "hex");
    const bufB = Buffer.from(expectedHash, "hex");
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }
  return false;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function readAuthStore(): AuthStore {
  ensureDataDir();
  if (!fs.existsSync(AUTH_FILE)) {
    const initial: AuthStore = {
      passwordConfig: null,
      sessions: []
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.passwordConfig && (!parsed.passwordConfig.hash || !parsed.passwordConfig.salt)) {
      parsed.passwordConfig = null;
    }
    if (!Array.isArray(parsed.sessions)) {
      parsed.sessions = [];
    }
    return parsed;
  } catch (e) {
    const fallback: AuthStore = {
      passwordConfig: null,
      sessions: []
    };
    saveAuthStore(fallback);
    return fallback;
  }
}

function saveAuthStore(store: AuthStore) {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function extractAdminToken(req: express.Request): string | null {
  // 1. Check HttpOnly Cookie
  if (req.cookies && req.cookies.jite_admin_session) {
    return req.cookies.jite_admin_session;
  }
  // 2. Check Authorization Header (Bearer token)
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function validateAdminSession(req: express.Request): boolean {
  const token = extractAdminToken(req);
  if (!token) return false;
  const store = readAuthStore();
  const validSession = store.sessions.find(
    (s) => s.token === token && s.expiresAt > Date.now()
  );
  return Boolean(validSession);
}

// Server-side middleware to protect admin actions
function requireAdminSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (validateAdminSession(req)) {
    return next();
  }
  return res.status(401).json({
    error: "Unauthorized. Please authenticate as administrator.",
    code: "UNAUTHORIZED_ADMIN"
  });
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
  if (!fs.existsSync(VEHICLES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(VEHICLES_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data.map(normalizeVehicle);
    }
  } catch (e) {
    console.error("Failed to parse vehicles.json", e);
  }
  return [];
}

function saveVehiclesStore(vehicles: any[]) {
  ensureDataDir();
  const normalized = Array.isArray(vehicles) ? vehicles.map(normalizeVehicle) : [];
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

app.post("/api/vehicles", requireAdminSession, (req, res) => {
  const newVehicles = req.body;
  if (!Array.isArray(newVehicles)) {
    return res.status(400).json({ error: "Expected array of vehicles" });
  }
  const saved = saveVehiclesStore(newVehicles);
  res.json({ success: true, count: saved.length, vehicles: saved });
});

app.delete("/api/vehicles/:id", requireAdminSession, (req, res) => {
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

app.post("/api/vehicles/delete", requireAdminSession, (req, res) => {
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

app.post("/api/vehicles/reset", requireAdminSession, (req, res) => {
  const current = readVehiclesStore();
  res.json({ success: true, vehicles: current });
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

// Admin Authentication Endpoints (Server-Side First-Time Setup & Password Auth)
app.all("/api/admin-auth", async (req, res) => {
  return adminAuthHandler(req, res);
});

app.get("/api/admin/auth/status", async (req, res) => {
  try {
    const config = await getAdminAuthConfig();
    const isSetup = Boolean(config && config.hash && config.salt);
    return res.json({
      isSetup,
      mode: "password_only"
    });
  } catch (err) {
    return res.json({ isSetup: false, mode: "password_only" });
  }
});

app.post("/api/admin/auth/setup", async (req, res) => {
  try {
    const existing = await getAdminAuthConfig();
    // Prevent overriding if already set up
    if (existing && existing.hash && existing.salt) {
      return res.status(400).json({
        success: false,
        error: "Administrator password has already been configured. Please log in."
      });
    }

    const { password, confirmPassword } = req.body || {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        error: "Administrator password is required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long."
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match."
      });
    }

    // Create salt & hash
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    const nowIso = new Date().toISOString();

    await saveAdminAuthConfig({
      salt,
      hash,
      updatedAt: nowIso
    });

    const store = readAuthStore();
    store.passwordConfig = { salt, hash, updatedAt: nowIso };

    // Automatically log in administrator upon first-time setup
    const token = generateToken();
    const session: AdminSession = {
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    store.sessions = [session];
    saveAuthStore(store);

    // Set secure HttpOnly cookie
    res.cookie("jite_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    });

    return res.json({
      success: true,
      token,
      role: "admin",
      message: "Administrator password configured successfully."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "Failed to configure administrator password." });
  }
});

app.post("/api/admin/auth/login", async (req, res) => {
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
      code: "RATE_LIMITED"
    });
  }

  const { password } = req.body || {};
  if (!password || typeof password !== "string") {
    recordFailedAttempt(clientIp);
    return res.status(400).json({
      success: false,
      error: "Please enter the administrator password."
    });
  }

  const config = await getAdminAuthConfig();

  // If no password configured yet, inform client to proceed to setup
  if (!config || !config.hash || !config.salt) {
    return res.status(400).json({
      success: false,
      needsSetup: true,
      error: "Administrator password has not been configured yet. Please complete initial setup."
    });
  }

  // Check stored hash
  const isValid = verifyPassword(password, config.salt, config.hash);

  if (!isValid) {
    recordFailedAttempt(clientIp);
    return res.status(401).json({
      success: false,
      error: "Incorrect administrator password. Please try again."
    });
  }

  // Password verified successfully
  resetRateLimit(clientIp);

  const token = generateToken();
  const session: AdminSession = {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  const store = readAuthStore();
  store.sessions = store.sessions.filter((s) => s.expiresAt > Date.now()).slice(-24);
  store.sessions.push(session);
  saveAuthStore(store);

  // Set secure HttpOnly cookie
  res.cookie("jite_admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });

  return res.json({
    success: true,
    token,
    role: "admin"
  });
});

app.get("/api/admin/auth/verify", (req, res) => {
  const isValid = validateAdminSession(req);
  if (!isValid) {
    return res.status(401).json({
      authenticated: false,
      error: "Session expired or unauthenticated."
    });
  }

  return res.json({
    authenticated: true,
    role: "admin"
  });
});

app.post("/api/admin/auth/change-password", requireAdminSession, async (req, res) => {
  const { currentPassword, oldPassword, newPassword, confirmPassword } = req.body || {};
  const passwordToCheck = currentPassword || oldPassword;

  if (!passwordToCheck || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "Both current password and new password are required."
    });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: "New password must be at least 8 characters long."
    });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: "New password and confirmation do not match."
    });
  }

  const config = await getAdminAuthConfig();
  if (!config || !config.hash || !config.salt) {
    return res.status(400).json({
      success: false,
      error: "No administrator password configured."
    });
  }

  const isValid = verifyPassword(passwordToCheck, config.salt, config.hash);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: "Incorrect current password. Please verify and try again."
    });
  }

  if (passwordToCheck === newPassword) {
    return res.status(400).json({
      success: false,
      error: "New password must be different from your current password."
    });
  }

  // Generate new cryptographic salt and hash
  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, newSalt);
  const nowIso = new Date().toISOString();

  await saveAdminAuthConfig({
    salt: newSalt,
    hash: newHash,
    updatedAt: nowIso
  });

  const store = readAuthStore();
  store.passwordConfig = {
    salt: newSalt,
    hash: newHash,
    updatedAt: nowIso
  };
  saveAuthStore(store);

  return res.json({
    success: true,
    message: "Administrator password changed successfully."
  });
});

app.post("/api/admin/auth/reset", async (req, res) => {
  const { resetKey } = req.body || {};
  const hasAdminSession = validateAdminSession(req);
  const envResetKey = process.env.ADMIN_RESET_KEY;
  const isKeyValid = envResetKey && typeof resetKey === "string" && resetKey === envResetKey;

  if (!hasAdminSession && !isKeyValid) {
    return res.status(403).json({
      success: false,
      error: "Unauthorized: Resetting admin password requires an active session or the server ADMIN_RESET_KEY."
    });
  }

  await clearAdminAuthConfig();
  const store = readAuthStore();
  store.passwordConfig = null;
  store.sessions = [];
  saveAuthStore(store);

  res.clearCookie("jite_admin_session", { path: "/" });
  return res.json({
    success: true,
    message: "Administrator password reset successfully. System returned to First-Time Setup."
  });
});

app.post("/api/admin/auth/logout", (req, res) => {
  const token = extractAdminToken(req);
  if (token) {
    const store = readAuthStore();
    store.sessions = store.sessions.filter((s) => s.token !== token);
    saveAuthStore(store);
  }

  res.clearCookie("jite_admin_session", { path: "/" });
  return res.json({ success: true });
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
  }

  // Universal HTML Page Handler with Dynamic Open Graph / Twitter Metadata Injection
  const renderDynamicPage = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip static assets, internal vite routes, and API endpoints
    const p = req.path;
    if (
      p.startsWith("/api/") ||
      p.startsWith("/@") ||
      p.startsWith("/src/") ||
      p.startsWith("/node_modules/") ||
      /\.(js|ts|tsx|jsx|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|json|map)$/i.test(p)
    ) {
      return next();
    }

    try {
      const vehicles = readVehiclesStore();
      const host = req.get("host") || "jiteautodeals-sable.vercel.app";
      const protocol = req.protocol || "https";
      const origin = `${protocol}://${host}`;
      const originalUrl = req.originalUrl || req.url || "/";

      // Resolve metadata dynamically based on route and query
      const meta = resolveRouteMetadata(originalUrl, vehicles, origin);

      let baseHtml = "";
      if (process.env.NODE_ENV !== "production" && vite) {
        const indexPath = path.join(process.cwd(), "index.html");
        baseHtml = fs.readFileSync(indexPath, "utf-8");
        baseHtml = await vite.transformIndexHtml(originalUrl, baseHtml);
      } else {
        const distIndexPath = path.join(process.cwd(), "dist", "index.html");
        if (fs.existsSync(distIndexPath)) {
          baseHtml = fs.readFileSync(distIndexPath, "utf-8");
        } else {
          const indexPath = path.join(process.cwd(), "index.html");
          baseHtml = fs.readFileSync(indexPath, "utf-8");
        }
      }

      // Inject full Open Graph, Twitter Card, and SEO metadata into HTML head
      const finalHtml = injectMetadataIntoHtml(baseHtml, meta);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(finalHtml);
    } catch (err) {
      next();
    }
  };

  // Mount HTML renderer for explicit routes
  app.get("/vehicles/:slug", renderDynamicPage);
  app.get("/car/:slug", renderDynamicPage);
  app.get("/v/:slug", renderDynamicPage);
  app.get("/browse", renderDynamicPage);
  app.get("/inventory", renderDynamicPage);
  app.get("/find-car", renderDynamicPage);
  app.get("/find-my-car", renderDynamicPage);
  app.get("/source-car", renderDynamicPage);
  app.get("/source-a-car", renderDynamicPage);
  app.get("/how-it-works", renderDynamicPage);
  app.get("/about", renderDynamicPage);
  app.get("/admin", renderDynamicPage);
  app.get("/", renderDynamicPage);

  if (process.env.NODE_ENV !== "production" && vite) {
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", renderDynamicPage);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
