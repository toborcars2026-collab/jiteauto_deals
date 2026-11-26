import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { resolveServerRouteMetadata, injectMetadataIntoHtml } from "./src/metaHelper";
import compression from "compression";
import adminAuthHandler, { verifyRequestAdmin } from "./api/admin-auth.js";
import cloudinaryHandler from "./api/cloudinary.js";
import dataHandler from "./api/data.js";
import uploadVehicleImageHandler from "./api/upload-vehicle-image.js";
import { firestoreQueryCollection } from "./api/firestore-rest.js";
import { isSupabaseServerConfigured, supabaseRest, mapVehicleRowToApp } from "./lib/supabase-rest.js";
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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
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

app.get("/api/download-android-project", (_req, res) => {
  const zipPath = path.join(process.cwd(), "public", "jite-auto-deals-android.zip");
  if (fs.existsSync(zipPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="jite-auto-deals-android-app.zip"');
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(zipPath);
  }
  return res.status(404).json({ error: "Android package not found" });
});

// Direct vehicle image upload & Supabase Storage signing/cleanup endpoint
app.all("/api/upload-vehicle-image", async (req, res) => {
  return uploadVehicleImageHandler(req, res);
});

// Unified Cloud Firestore + Local Mirror API Routes (exact parity with Vercel api/data.js)
app.get("/api/vehicles", async (req, res) => {
  req.query = { ...req.query, resource: "vehicles", action: "" };
  return dataHandler(req, res);
});

app.post("/api/vehicles", requireVerifiedAdmin, (req, res) => {
  const newVehicles = req.body;
  if (!Array.isArray(newVehicles)) {
    return res.status(400).json({ error: "Expected array of vehicles" });
  }
  const saved = saveVehiclesStore(newVehicles);
  res.json({ success: true, count: saved.length, vehicles: saved });
});

app.post("/api/vehicles/upsert", async (req, res) => {
  req.query = { ...req.query, resource: "vehicles", action: "upsert" };
  return dataHandler(req, res);
});

app.delete("/api/vehicles/:id", async (req, res) => {
  req.query = { ...req.query, resource: "vehicles", action: req.params.id };
  return dataHandler(req, res);
});

app.post("/api/vehicles/delete", async (req, res) => {
  req.query = { ...req.query, resource: "vehicles", action: "delete" };
  return dataHandler(req, res);
});

app.post("/api/vehicles/reset", requireVerifiedAdmin, async (_req, res) => {
  try {
    if (isSupabaseServerConfigured()) {
      const rows = await supabaseRest("vehicles?select=*&order=created_at.desc");
      const sbVehicles = (Array.isArray(rows) ? rows : []).map((r: any) => mapVehicleRowToApp(r)).filter(Boolean);
      saveVehiclesStore(sbVehicles);
      return res.json({ success: true, vehicles: sbVehicles });
    }
    const fsVehicles = await firestoreQueryCollection("vehicles");
    saveVehiclesStore(fsVehicles);
    return res.json({ success: true, vehicles: fsVehicles });
  } catch {
    const current = readVehiclesStore();
    return res.json({ success: true, vehicles: current });
  }
});

app.all("/api/leads", async (req, res) => {
  req.query = { ...req.query, resource: "leads", action: "" };
  return dataHandler(req, res);
});

app.all("/api/leads/:action", async (req, res) => {
  req.query = { ...req.query, resource: "leads", action: req.params.action };
  return dataHandler(req, res);
});

app.all("/api/inquiries", async (req, res) => {
  req.query = { ...req.query, resource: "inquiries", action: "" };
  return dataHandler(req, res);
});

app.all("/api/inquiries/:action", async (req, res) => {
  req.query = { ...req.query, resource: "inquiries", action: req.params.action };
  return dataHandler(req, res);
});

app.all("/api/business-settings", async (req, res) => {
  req.query = { ...req.query, resource: "business-settings", action: "" };
  return dataHandler(req, res);
});

app.all("/api/editorial-posts", async (req, res) => {
  req.query = { ...req.query, resource: "editorial-posts", action: "" };
  return dataHandler(req, res);
});

app.all("/api/analytics", async (req, res) => {
  req.query = { ...req.query, resource: "analytics", action: String(req.query?.action || "") };
  return dataHandler(req, res);
});

app.all("/api/data", async (req, res) => {
  return dataHandler(req, res);
});

// Unified Administrator Authentication & Security Verification Routes (matches vercel.json)
app.all("/api/admin-auth", async (req, res) => {
  return adminAuthHandler(req, res);
});

app.all("/api/admin/auth/:action", async (req, res) => {
  req.query = { ...req.query, action: req.params.action };
  return adminAuthHandler(req, res);
});

app.all("/api/cloudinary", async (req, res) => {
  return cloudinaryHandler(req, res);
});

app.all("/api/cloudinary-sign", async (req, res) => {
  req.query = { ...req.query, action: "sign" };
  return cloudinaryHandler(req, res);
});

app.all("/api/cloudinary-delete", async (req, res) => {
  req.query = { ...req.query, action: "delete" };
  return cloudinaryHandler(req, res);
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
