const express = require("express");
const MovimientoInventarioService = require("../services/servicesMovimientoInventario");
const route = express.Router();

const movimientoInventarioService = new MovimientoInventarioService();

// Ruta GET para obtener todos los movimientos de inventario
route.get("/", async (req, res) => {
  try {
    const movimientos =
      await movimientoInventarioService.getAllMovimientosInventario();
    res.json(movimientos);
  } catch (error) {
    console.error("Error fetching movimientosInventario:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un movimiento de inventario por id_movimiento
route.get("/:id_movimiento", async (req, res) => {
  try {
    const { id_movimiento } = req.params;
    const movimiento =
      await movimientoInventarioService.getMovimientoInventario(id_movimiento);
    res.json(movimiento);
  } catch (error) {
    console.error("Error fetching movimientoInventario:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo movimiento de inventario
route.post("/", async (req, res) => {
  try {
    const newMovimiento =
      await movimientoInventarioService.createMovimientoInventario(req.body);
    res.status(201).json(newMovimiento);
  } catch (error) {
    console.error("Error creating movimientoInventario:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un movimiento de inventario por id_movimiento
route.put("/:id_movimiento", async (req, res) => {
  try {
    const { id_movimiento } = req.params;
    const updatedMovimiento =
      await movimientoInventarioService.updateMovimientoInventario(
        id_movimiento,
        req.body
      );
    res.json(updatedMovimiento);
  } catch (error) {
    console.error("Error updating movimientoInventario:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un movimiento de inventario por id_movimiento
route.delete("/:id_movimiento", async (req, res) => {
  try {
    const { id_movimiento } = req.params;
    const message =
      await movimientoInventarioService.deleteMovimientoInventario(
        id_movimiento
      );
    res.json(message);
  } catch (error) {
    console.error("Error deleting movimientoInventario:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
