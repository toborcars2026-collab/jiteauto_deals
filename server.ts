import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { resolveServerRouteMetadata, injectMetadataIntoHtml } from "./src/metaHelper";
import compression from "compression";
import adminAuthHandler, { verifyRequestAdmin } from "./api/admin-auth.js";
import renderPageHandler from "./api/render.js";

const app = express();
const PORT = 3000;

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const DATA_DIR = path.join(process.cwd(), "data_store");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  })
);

const VEHICLES_FILE = path.join(DATA_DIR, "vehicles.json");
const DELETED_FILE = path.join(DATA_DIR, "deleted_ids.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "inquiries.json");

async function requireVerifiedAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const result = await verifyRequestAdmin(req);
  if (result.authorized) {
    (req as any).adminUser = result;
    return next();
  }
  return res.status(401).json({
    error: "Unauthorized. Please authenticate as an authorized administrator.",
    code: "UNAUTHORIZED_ADMIN",
  });
}

const KNOWN_DELETED_IDS = new Set<string>([
  "toyota-corolla-s-2015-silver-few-months-used",
  "lexus-rx350-2015-silver-duty-paid",
  "toyota-highlander-xle-2017-brown-foreign-used",
  "toyota-corolla-le-2015-silver-direct-belgium",
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

function decodeUnicodeEscapes(str: any): any {
  if (!str || typeof str !== "string") return str;
  let res = str;

  res = res.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/\\u([0-9a-fA-F]{4})/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/\\U([0-9a-fA-F]{8})/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/\\x([0-9a-fA-F]{2})/g, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    } catch {
      return _;
    }
  });

  res = res.replace(/&#x([0-9a-fA-F]{1,6});/gi, (_: string, hex: string) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/&#([0-9]{1,7});/g, (_: string, dec: string) => {
    try {
      const code = parseInt(dec, 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/^2728\s+/g, "✨ ");
  res = res.replace(/\s+2728$/g, " ✨");
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
  } catch {
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
  } catch {
    return [];
  }
}

function saveInquiriesStore(inquiries: any[]) {
  ensureDataDir();
  fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2), "utf-8");
}

// API Anti-Cache Middleware
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
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return res.status(400).json({ error: "Invalid image URL protocol" });
    }
    if (targetUrl.includes("ibb.co/") && !targetUrl.includes("i.ibb.co/")) {
      const response = await fetch(targetUrl);
      const text = await response.text();
      const match = text.match(/meta property="og:image" content="([^"]+)"/);
      if (match && match[1]) {
        return res.json({ resolvedUrl: match[1] });
      }
    }
    return res.json({ resolvedUrl: targetUrl });
  } catch {
    return res.json({ resolvedUrl: targetUrl });
  }
});

app.get("/api/vehicles", (_req, res) => {
  const vehicles = readVehiclesStore();
  res.json(vehicles);
});

app.get("/api/download-android-project", (_req, res) => {
  const zipPath = path.join(process.cwd(), "public", "jite-auto-deals-android.zip");
  if (fs.existsSync(zipPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="jite-auto-deals-android-app.zip"');
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(zipPath);
  }
  return res.status(404).json({ error: "Android package not found" });
});

// Direct vehicle image upload endpoint (Protected by Verified Admin Bearer Token)
app.post("/api/upload-vehicle-image", requireVerifiedAdmin, (req, res) => {
  try {
    const { vehicleId, base64Data } = req.body || {};
    if (!base64Data || typeof base64Data !== "string") {
      return res.status(400).json({ error: "Missing base64Data image payload" });
    }

    const cleanVehicleId = (vehicleId || "car").replace(/[^a-zA-Z0-9_-]/g, "_");
    const vehicleUploadsDir = path.join(UPLOADS_DIR, "vehicles", cleanVehicleId);
    if (!fs.existsSync(vehicleUploadsDir)) {
      fs.mkdirSync(vehicleUploadsDir, { recursive: true });
    }

    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid image MIME type" });
    }

    const rawData = matches ? matches[2] : base64Data;
    const buffer = Buffer.from(rawData, "base64");

    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: "Image file exceeds maximum 15MB limit" });
    }

    let ext = "jpg";
    if (mimeType.includes("png")) ext = "png";
    else if (mimeType.includes("webp")) ext = "webp";

    const uniqueName = `img_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const targetFilePath = path.join(vehicleUploadsDir, uniqueName);
    fs.writeFileSync(targetFilePath, buffer);

    const relativeUrl = `/uploads/vehicles/${cleanVehicleId}/${uniqueName}`;
    return res.json({
      success: true,
      url: relativeUrl,
      size: buffer.length,
      mimeType,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Failed to save uploaded image: " + err.message });
  }
});

app.post("/api/vehicles", requireVerifiedAdmin, (req, res) => {
  const newVehicles = req.body;
  if (!Array.isArray(newVehicles)) {
    return res.status(400).json({ error: "Expected array of vehicles" });
  }
  const saved = saveVehiclesStore(newVehicles);
  res.json({ success: true, count: saved.length, vehicles: saved });
});

app.delete("/api/vehicles/:id", requireVerifiedAdmin, (req, res) => {
  const vehicleId = req.params.id;
  if (!vehicleId) {
    return res.status(400).json({ error: "Missing vehicle id" });
  }
  recordDeletedId(vehicleId);
  const current = readVehiclesStore();
  const filtered = current.filter((v: any) => v.id !== vehicleId);
  saveVehiclesStore(filtered);
  res.json({ success: true, deletedId: vehicleId, remaining: filtered.length });
});

app.post("/api/vehicles/delete", requireVerifiedAdmin, (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "Missing vehicle id" });
  }
  recordDeletedId(id);
  const current = readVehiclesStore();
  const filtered = current.filter((v: any) => v.id !== id);
  saveVehiclesStore(filtered);
  res.json({ success: true, deletedId: id, remaining: filtered.length });
});

app.post("/api/vehicles/reset", requireVerifiedAdmin, (_req, res) => {
  const current = readVehiclesStore();
  res.json({ success: true, vehicles: current });
});

app.get("/api/leads", requireVerifiedAdmin, (_req, res) => {
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

app.get("/api/inquiries", requireVerifiedAdmin, (_req, res) => {
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

// Unified Administrator Authentication & Security Verification Routes (matches vercel.json)
app.all("/api/admin-auth", async (req, res) => {
  return adminAuthHandler(req, res);
});

app.all("/api/admin/auth/:action", async (req, res) => {
  req.query = { ...req.query, action: req.params.action };
  return adminAuthHandler(req, res);
});

app.post(["/api/ai/consultant", "/api/ai-consultant"], async (_req, res) => {
  return res.status(404).json({ error: "AI consultant endpoint is not active." });
});

app.get("/api/render", async (req, res) => {
  return renderPageHandler(req, res);
});

async function startServer() {
  let vite: any = null;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  const renderDynamicPage = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
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
      const originalUrl = req.originalUrl || req.url || "/";
      const meta = await resolveServerRouteMetadata(originalUrl, vehicles);

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

      const finalHtml = injectMetadataIntoHtml(baseHtml, meta);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(finalHtml);
    } catch {
      next();
    }
  };

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
    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
          } else if (/\.(js|css|woff2|woff|ttf|png|jpg|jpeg|webp|avif|svg|ico)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      })
    );
    app.get("*", renderDynamicPage);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
