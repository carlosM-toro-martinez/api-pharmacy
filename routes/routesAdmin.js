const express = require("express");
const Admin = require("../services/servicesAdmin");
const route = express.Router();

const adminService = new Admin();

// Ruta GET para obtener todos los administradores
route.get("/", async (req, res) => {
  try {
    const admins = await adminService.getAllAdmins();
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un administrador por ID
route.get("/:id", async (req, res) => {
  try {
    const admin = await adminService.getAdminById(req.params.id);
    res.json(admin);
  } catch (error) {
    console.error("Error fetching admin by ID:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo administrador
route.post("/", async (req, res) => {
  try {
    const newAdmin = await adminService.createAdmin(req.body);
    res.status(201).json(newAdmin);
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un administrador por ID
route.put("/:id", async (req, res) => {
  try {
    const updatedAdmin = await adminService.updateAdmin(
      req.params.id,
      req.body
    );
    res.json(updatedAdmin);
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un administrador por ID
route.delete("/:id", async (req, res) => {
  try {
    const message = await adminService.deleteAdmin(req.params.id);
    res.json(message);
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
