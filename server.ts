import express from "express";
import path from "path";
import fs from "fs";
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
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "inquiries.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Helper functions for reading and writing JSON storage
function readVehiclesStore() {
  ensureDataDir();
  if (!fs.existsSync(VEHICLES_FILE)) {
    fs.writeFileSync(VEHICLES_FILE, JSON.stringify(INITIAL_VEHICLES, null, 2), "utf-8");
    return INITIAL_VEHICLES;
  }
  try {
    const raw = fs.readFileSync(VEHICLES_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.error("Failed to parse vehicles.json, falling back to seed data", e);
  }
  fs.writeFileSync(VEHICLES_FILE, JSON.stringify(INITIAL_VEHICLES, null, 2), "utf-8");
  return INITIAL_VEHICLES;
}

function saveVehiclesStore(vehicles: any[]) {
  ensureDataDir();
  fs.writeFileSync(VEHICLES_FILE, JSON.stringify(vehicles, null, 2), "utf-8");
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

// API Routes
app.get("/api/vehicles", (req, res) => {
  const vehicles = readVehiclesStore();
  res.json(vehicles);
});

app.post("/api/vehicles", (req, res) => {
  const newVehicles = req.body;
  if (!Array.isArray(newVehicles)) {
    return res.status(400).json({ error: "Expected array of vehicles" });
  }
  saveVehiclesStore(newVehicles);
  res.json({ success: true, count: newVehicles.length, vehicles: newVehicles });
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

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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
