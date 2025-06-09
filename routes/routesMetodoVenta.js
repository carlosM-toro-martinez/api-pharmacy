const express = require("express");
const MetodoVentaService = require("../services/servicesMetodoVenta");
const route = express.Router();

const metodoVentaService = new MetodoVentaService();

// Ruta GET para obtener todos los métodos de venta
route.get("/", async (req, res) => {
  try {
    const metodosVenta = await metodoVentaService.getAllMetodosVenta();
    res.json(metodosVenta);
  } catch (error) {
    console.error("Error fetching metodos de venta:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/producto/:id_producto", async (req, res) => {
  try {
    const { id_producto } = req.params;
    const metodoVenta = await metodoVentaService.getMetodoVentaByProducto(
      id_producto
    );
    res.json(metodoVenta);
  } catch (error) {
    console.error("Error fetching metodo de venta:", error);
    res.status(404).json({ error: error.message });
  }
});

route.post("/", async (req, res) => {
  try {
    const newMetodoVenta = await metodoVentaService.createMetodoVenta(req.body);
    res.status(201).json(newMetodoVenta);
  } catch (error) {
    console.error("Error creating metodo de venta:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un método de venta por id_metodo_venta
route.put("/:id_metodo_venta", async (req, res) => {
  try {
    const { id_metodo_venta } = req.params;
    const updatedMetodoVenta = await metodoVentaService.updateMetodoVenta(
      id_metodo_venta,
      req.body
    );
    res.json(updatedMetodoVenta);
  } catch (error) {
    console.error("Error updating metodo de venta:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un método de venta por id_metodo_venta
route.delete("/:id_metodo_venta", async (req, res) => {
  try {
    const { id_metodo_venta } = req.params;
    const message = await metodoVentaService.deleteMetodoVenta(id_metodo_venta);
    res.json(message);
  } catch (error) {
    console.error("Error deleting metodo de venta:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
