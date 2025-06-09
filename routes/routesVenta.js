const express = require("express");
const VentaService = require("../services/servicesVenta");
const route = express.Router();

const ventaService = new VentaService();

// Ruta GET para obtener todas las ventas
route.get("/", async (req, res) => {
  try {
    const ventas = await ventaService.getAllVentas();
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener todas las ventas
route.get("/hoy", async (req, res) => {
  try {
    const ventas = await ventaService.getVentasDelDia();
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas del dia:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener una venta por id_venta
route.get("/:id_venta", async (req, res) => {
  try {
    const { id_venta } = req.params;
    const venta = await ventaService.getVenta(id_venta);
    res.json(venta);
  } catch (error) {
    console.error("Error fetching venta:", error);
    res.status(404).json({ error: error.message });
  }
});

route.post("/venta-completa", async (req, res) => {
  try {
    const { ventaData, detalles, id_caja } = req.body;
    const venta = await ventaService.realizarVentaCompleta(
      ventaData,
      detalles,
      id_caja
    );
    res.status(201).json({ success: true, venta });
  } catch (error) {
    console.error("Error al procesar venta completa:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

route.post("/movimiento-inventario", async (req, res) => {
  try {
    const ventaDetalles = req.body;

    const resultado = await ventaService.procesarInventario(ventaDetalles);

    res.status(201).json(resultado);
  } catch (error) {
    console.error("Error procesando venta:", error);
    res.status(500).json({ error: error.message });
  }
});

route.post("/anular-venta", async (req, res) => {
  try {
    const ventaDetalles = req.body;

    const resultado = await ventaService.anularVenta(ventaDetalles);

    res.status(201).json(resultado);
  } catch (error) {
    console.error("Error anular venta:", error);
    res.status(500).json({ error: error.message });
  }
});

// route.post("/procesar-venta", async (req, res) => {
//   try {
//     const ventaDetalles = req.body;

//     // Llamamos al servicio para procesar la venta
//     const resultado = await ventaService.procesarVenta(ventaDetalles);

//     res.status(201).json(resultado);
//   } catch (error) {
//     console.error("Error procesando venta:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Ruta POST para crear una nueva venta
// route.post("/", async (req, res) => {
//   try {
//     const newVenta = await ventaService.createVenta(req.body);
//     res.status(201).json(newVenta);
//   } catch (error) {
//     console.error("Error creating venta:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// Ruta PUT para actualizar una venta por id_venta
route.put("/:id_venta", async (req, res) => {
  try {
    const { id_venta } = req.params;
    const updatedVenta = await ventaService.updateVenta(id_venta, req.body);
    res.json(updatedVenta);
  } catch (error) {
    console.error("Error updating venta:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar una venta por id_venta
route.delete("/:id_venta", async (req, res) => {
  try {
    const { id_venta } = req.params;
    const message = await ventaService.deleteVenta(id_venta);
    res.json(message);
  } catch (error) {
    console.error("Error deleting venta:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
