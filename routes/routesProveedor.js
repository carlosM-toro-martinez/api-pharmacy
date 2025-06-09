const express = require("express");
const ProveedorService = require("../services/servicesProveedor");
const route = express.Router();

const proveedorService = new ProveedorService();

// Ruta GET para obtener todos los proveedores
route.get("/", async (req, res) => {
  try {
    const proveedores = await proveedorService.getAllProveedores();
    res.json(proveedores);
  } catch (error) {
    console.error("Error fetching proveedores:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un proveedor por id_proveedor
route.get("/:id_proveedor", async (req, res) => {
  try {
    const { id_proveedor } = req.params;
    const proveedor = await proveedorService.getProveedor(id_proveedor);
    res.json(proveedor);
  } catch (error) {
    console.error("Error fetching proveedor:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo proveedor
route.post("/", async (req, res) => {
  try {
    const newProveedor = await proveedorService.createProveedor(req.body);
    res.status(201).json(newProveedor);
  } catch (error) {
    console.error("Error creating proveedor:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un proveedor por id_proveedor
route.put("/:id_proveedor", async (req, res) => {
  try {
    const { id_proveedor } = req.params;
    const updatedProveedor = await proveedorService.updateProveedor(
      id_proveedor,
      req.body
    );
    res.json(updatedProveedor);
  } catch (error) {
    console.error("Error updating proveedor:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un proveedor por id_proveedor
route.delete("/:id_proveedor", async (req, res) => {
  try {
    const { id_proveedor } = req.params;
    const message = await proveedorService.deleteProveedor(id_proveedor);
    res.json(message);
  } catch (error) {
    console.error("Error deleting proveedor:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
