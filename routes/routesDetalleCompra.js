const express = require("express");
const DetalleCompraService = require("../services/servicesDetalleCompra");
const route = express.Router();

const detalleCompraService = new DetalleCompraService();

// Ruta GET para obtener todos los detalles de compra
route.get("/", async (req, res) => {
  try {
    const detallesCompra = await detalleCompraService.getAllDetallesCompra();
    res.json(detallesCompra);
  } catch (error) {
    console.error("Error fetching detalles de compra:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/:numeroLote", async (req, res) => {
  try {
    const { numeroLote } = req.params;
    const detallesCompra = await detalleCompraService.getDetallesCompraByLote(
      numeroLote
    );
    res.json(detallesCompra);
  } catch (error) {
    console.error("Error fetching detalles de compra by lote:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un detalle de compra por id_detalle
route.get("/:id_detalle", async (req, res) => {
  try {
    const { id_detalle } = req.params;
    const detalleCompra = await detalleCompraService.getDetalleCompra(
      id_detalle
    );
    res.json(detalleCompra);
  } catch (error) {
    console.error("Error fetching detalle de compra:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo detalle de compra
route.post("/", async (req, res) => {
  try {
    const newDetalleCompra = await detalleCompraService.createDetalleCompra(
      req.body
    );
    res.status(201).json(newDetalleCompra);
  } catch (error) {
    console.error("Error creating detalle de compra:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un detalle de compra por id_detalle
route.put("/:id_detalle", async (req, res) => {
  try {
    const { id_detalle } = req.params;
    const updatedDetalleCompra = await detalleCompraService.updateDetalleCompra(
      id_detalle,
      req.body
    );
    res.json(updatedDetalleCompra);
  } catch (error) {
    console.error("Error updating detalle de compra:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un detalle de compra por id_detalle
// route.delete("/:id_detalle", async (req, res) => {
//   try {
//     const { id_detalle } = req.params;
//     const message = await detalleCompraService.deleteDetalleCompra(id_detalle);
//     res.json(message);
//   } catch (error) {
//     console.error("Error deleting detalle de compra:", error);
//     res.status(404).json({ error: error.message });
//   }
// });

route.delete('/:id_detalle', async (req, res) => {
  try {
    const { id_detalle } = req.params;
    const detalle = req.body;

    const result = await detalleCompraService.eliminarInventarioYActualizarProducto({
      id_detalle,
      ...detalle,
    });

    res.json(result);
  } catch (error) {
    console.error('Error eliminando inventario y actualizando producto:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = route;
