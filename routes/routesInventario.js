const express = require("express");
const InventarioService = require("../services/servicesInventario");
const route = express.Router();

const inventarioService = new InventarioService();

route.get("/", async (req, res) => {
  try {
    const inventarios = await inventarioService.getAllProductosConInventarios({
      id_sucursal: req.query.id_sucursal || req.headers["x-sucursal-id"],
      transferencia: req.query.transferencia === "true",
      q: req.query.q,
      limit: req.query.limit,
    });
    res.json(inventarios);
  } catch (error) {
    console.error("Error fetching inventarios:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/buscar-sucursales", async (req, res) => {
  try {
    const resultados = await inventarioService.buscarStockPorSucursales({
      q: req.query.q,
      excluir_sucursal:
        req.query.excluir_sucursal || req.headers["x-sucursal-id"],
      limit: req.query.limit,
    });
    res.json(resultados);
  } catch (error) {
    console.error("Error buscando stock en otras sucursales:", error);
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
