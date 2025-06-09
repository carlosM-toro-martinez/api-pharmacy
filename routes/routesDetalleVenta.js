const express = require("express");
const DetalleVentaService = require("../services/servicesDetalleVenta");
const route = express.Router();

const detalleVentaService = new DetalleVentaService();

// Ruta GET para obtener todos los detalles de venta
route.get("/", async (req, res) => {
  try {
    const detallesVenta = await detalleVentaService.getAllDetallesVenta();
    res.json(detallesVenta);
  } catch (error) {
    console.error("Error fetching detallesVenta:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un detalle de venta por id_detalle
route.get("/:id_detalle", async (req, res) => {
  try {
    const { id_detalle } = req.params;
    const detalleVenta = await detalleVentaService.getDetalleVenta(id_detalle);
    res.json(detalleVenta);
  } catch (error) {
    console.error("Error fetching detalleVenta:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo detalle de venta
route.post("/", async (req, res) => {
  try {
    const newDetalleVenta = await detalleVentaService.createDetalleVenta(
      req.body
    );
    res.status(201).json(newDetalleVenta);
  } catch (error) {
    console.error("Error creating detalleVenta:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un detalle de venta por id_detalle
route.put("/:id_detalle", async (req, res) => {
  try {
    const { id_detalle } = req.params;
    const updatedDetalleVenta = await detalleVentaService.updateDetalleVenta(
      id_detalle,
      req.body
    );
    res.json(updatedDetalleVenta);
  } catch (error) {
    console.error("Error updating detalleVenta:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un detalle de venta por id_detalle
route.delete("/:id_detalle", async (req, res) => {
  try {
    const { id_detalle } = req.params;
    const message = await detalleVentaService.deleteDetalleVenta(id_detalle);
    res.json(message);
  } catch (error) {
    console.error("Error deleting detalleVenta:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
