http://localhost:8081/admin/login/**
 * GamanaLK Backend Server - Fallback version using JSON file storage
 * Run this when MongoDB is not available.
 */
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "admin-secret-key-gamana-lk-2024";
const DRIVER_JWT_SECRET = process.env.DRIVER_JWT_SECRET || "driver-secret-key-gamana-lk-2024";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Seed Data ──────────────────────────────────────────────────
async function seedData() {
  const count = db.drivers.countDocuments();
  if (count > 0) {
    console.log(`📊 ${count} drivers already in database`);
    return;
  }

  const hashedPassword = await bcrypt.hash("driver123", 10);

  db.drivers.insertMany([
    { fullName: "Supun Perera", phone: "+94771234567", licenseNumber: "B-12345", experience: "5 years", status: "pending" },
    { fullName: "Kamal Fernando", phone: "+94772345678", licenseNumber: "B-23456", experience: "8 years", status: "pending" },
    { fullName: "Nimal Silva", phone: "+94773456789", licenseNumber: "B-34567", experience: "3 years", status: "approved", employeeId: "DRV-001", password: hashedPassword },
    { fullName: "Priya Jayawardena", phone: "+94774567890", licenseNumber: "B-45678", experience: "6 years", status: "rejected" },
    { fullName: "Rohan de Silva", phone: "+94775678901", licenseNumber: "B-56789", experience: "10 years", status: "pending" },
    { fullName: "Dinesh Kumar", phone: "+94776789012", licenseNumber: "B-67890", experience: "4 years", status: "pending" },
    { fullName: "Samantha Rathnayake", phone: "+94777890123", licenseNumber: "B-78901", experience: "7 years", status: "pending" },
    { fullName: "Test Approved Driver", phone: "+94770000001", licenseNumber: "B-00001", experience: "2 years", status: "approved", employeeId: "DRV-002", password: hashedPassword },
  ]);

  console.log("✅ Seeded 8 test drivers!");
  const stats = db.drivers.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  console.log("📊 Stats:", JSON.stringify(stats));
}

// ─── Health Check ───────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "SmartBusTracker API is running (fallback mode)",
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════

// Admin Auth Middleware
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }
  try {
    const token = authHeader.split(" ")[1];
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

// Admin Login
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }
  if (email !== "admin@gamanalak.com" || password !== "admin123") {
    return res.status(401).json({ success: false, message: "Invalid admin credentials" });
  }
  const token = jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      admin: { name: "Admin User", email: "admin@gamanalak.com", role: "Fleet Manager" },
    },
  });
});

// GET /api/admin/drivers
app.get("/api/admin/drivers", authenticateAdmin, (req, res) => {
  try {
    const result = db.drivers.findAll({
      status: req.query.status || "all",
      search: req.query.search || "",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });
    // Remove passwords
    const drivers = result.drivers.map(({ password, ...d }) => d);
    res.json({ success: true, data: { drivers, pagination: result.pagination } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch drivers" });
  }
});

// GET /api/admin/drivers/stats
app.get("/api/admin/drivers/stats", authenticateAdmin, (req, res) => {
  try {
    const total = db.drivers.countDocuments();
    const pending = db.drivers.countDocuments({ status: "pending" });
    const approved = db.drivers.countDocuments({ status: "approved" });
    const rejected = db.drivers.countDocuments({ status: "rejected" });
    res.json({ success: true, data: { total, pending, approved, rejected } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch statistics" });
  }
});

// PUT /api/admin/drivers/:id/status
app.put("/api/admin/drivers/:id/status", authenticateAdmin, async (req, res) => {
  try {
    const { status, employeeId, password } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'" });
    }
    const driver = db.drivers.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }
    const updateData = { status };
    if (status === "approved") {
      if (!employeeId || !password) {
        return res.status(400).json({ success: false, message: "Employee ID and password are required" });
      }
      const existing = db.drivers.findOne({ employeeId: employeeId.toUpperCase() });
      if (existing && existing._id !== driver._id) {
        return res.status(400).json({ success: false, message: "Employee ID already assigned" });
      }
      updateData.employeeId = employeeId.toUpperCase();
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updated = db.drivers.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
    res.json({
      success: true,
      message: status === "approved"
        ? `Driver ${driver.fullName} approved successfully`
        : `Driver ${driver.fullName} has been rejected`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update driver status" });
  }
});

// GET /api/admin/drivers/:id
app.get("/api/admin/drivers/:id", authenticateAdmin, (req, res) => {
  const driver = db.drivers.findById(req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
  const { password, ...d } = driver;
  res.json({ success: true, data: d });
});

// DELETE /api/admin/drivers/:id
app.delete("/api/admin/drivers/:id", authenticateAdmin, (req, res) => {
  const driver = db.drivers.findByIdAndDelete(req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
  res.json({ success: true, message: `Driver ${driver.fullName} removed` });
});

// POST /api/admin/seed
app.post("/api/admin/seed", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash("driver123", 10);
    db.drivers.deleteMany();
    db.drivers.insertMany([
      { fullName: "Supun Perera", phone: "+94771234567", licenseNumber: "B-12345", experience: "5 years", status: "pending" },
      { fullName: "Kamal Fernando", phone: "+94772345678", licenseNumber: "B-23456", experience: "8 years", status: "pending" },
      { fullName: "Nimal Silva", phone: "+94773456789", licenseNumber: "B-34567", experience: "3 years", status: "approved", employeeId: "DRV-001", password: hashedPassword },
      { fullName: "Priya Jayawardena", phone: "+94774567890", licenseNumber: "B-45678", experience: "6 years", status: "rejected" },
      { fullName: "Rohan de Silva", phone: "+94775678901", licenseNumber: "B-56789", experience: "10 years", status: "pending" },
      { fullName: "Dinesh Kumar", phone: "+94776789012", licenseNumber: "B-67890", experience: "4 years", status: "pending" },
      { fullName: "Samantha Rathnayake", phone: "+94777890123", licenseNumber: "B-78901", experience: "7 years", status: "pending" },
      { fullName: "Test Driver2", phone: "+94770000002", licenseNumber: "B-00002", experience: "2 years", status: "approved", employeeId: "DRV-002", password: hashedPassword },
    ]);
    const stats = db.drivers.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    res.json({ success: true, message: "Seeded test drivers", data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Seed failed" });
  }
});

// DELETE /api/admin/seed
app.delete("/api/admin/seed", (req, res) => {
  const result = db.drivers.deleteMany();
  res.json({ success: true, message: `Deleted ${result.deletedCount} drivers` });
});

// ═══════════════════════════════════════════════════════════════════
// DRIVER ROUTES
// ═══════════════════════════════════════════════════════════════════

// POST /api/driver/login
app.post("/api/driver/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ success: false, message: "Employee ID and password are required" });
    }
    const driver = db.drivers.findOne({ employeeId: employeeId.trim().toUpperCase() });
    if (!driver) {
      return res.status(401).json({ success: false, message: "Invalid Employee ID or password" });
    }
    if (driver.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: driver.status === "pending"
          ? "Your application is still pending approval"
          : "Your application has been rejected",
      });
    }
    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid Employee ID or password" });
    }
    const token = jwt.sign(
      { id: driver._id, employeeId: driver.employeeId, role: "driver" },
      DRIVER_JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({
      success: true,
      message: "Login successful",
      token,
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        employeeId: driver.employeeId,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

// POST /api/driver/register
app.post("/api/driver/register", (req, res) => {
  try {
    const { fullName, employeeId, phone, licenseNumber, experience } = req.body;
    if (!fullName || !phone || !licenseNumber || !experience) {
      return res.status(400).json({ success: false, message: "Please fill in all mandatory fields!" });
    }
    const existing = db.drivers.findOne({ licenseNumber: licenseNumber.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "License number already registered!" });
    }
    const driver = db.drivers.create({
      fullName: fullName.trim(),
      employeeId: employeeId?.trim() || "",
      phone: phone.trim(),
      licenseNumber: licenseNumber.trim().toUpperCase(),
      experience,
      status: "pending",
    });
    res.status(201).json({
      success: true,
      message: "Application sent for review",
      data: { id: driver._id, fullName: driver.fullName, status: driver.status },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// GET /api/driver/status/:id
app.get("/api/driver/status/:id", (req, res) => {
  const driver = db.drivers.findById(req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
  res.json({
    success: true,
    data: {
      fullName: driver.fullName,
      licenseNumber: driver.licenseNumber,
      status: driver.status,
      createdAt: driver.createdAt,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// Error Handler & Start
// ═══════════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 GamanaLK Fallback Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`⚠️ Using JSON file storage (no MongoDB required)`);
  seedData();
});
