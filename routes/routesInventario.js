const express = require("express");
const InventarioService = require("../services/servicesInventario");
const route = express.Router();

const inventarioService = new InventarioService();

route.get("/", async (req, res) => {
  try {
    const inventarios = await inventarioService.getAllProductosConInventarios();
    res.json(inventarios);
  } catch (error) {
    console.error("Error fetching inventarios:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/:id_inventario", async (req, res) => {
  try {
    const { id_inventario } = req.params;
    const inventario = await inventarioService.getInventario(id_inventario);
    res.json(inventario);
  } catch (error) {
    console.error("Error fetching inventario:", error);
    res.status(404).json({ error: error.message });
  }
});

route.post("/", async (req, res) => {
  try {
    const newInventario = await inventarioService.createInventario(req.body);
    res.status(201).json(newInventario);
  } catch (error) {
    console.error("Error creating inventario:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.put("/:id_inventario", async (req, res) => {
  try {
    const { id_inventario } = req.params;
    const updatedInventario = await inventarioService.updateInventario(
      id_inventario,
      req.body
    );
    res.json(updatedInventario);
  } catch (error) {
    console.error("Error updating inventario:", error);
    res.status(404).json({ error: error.message });
  }
});

route.delete("/:id_inventario", async (req, res) => {
  try {
    const { id_inventario } = req.params;
    const message = await inventarioService.deleteInventario(id_inventario);
    res.json(message);
  } catch (error) {
    console.error("Error deleting inventario:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
