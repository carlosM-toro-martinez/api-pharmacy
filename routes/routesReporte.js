// routes/reporteRoutes.js
const express = require("express");
const ReporteService = require("../services/servicesReporte");
const route = express.Router();

const reporteService = new ReporteService();

route.get("/almacenes/movimientos/:idInicio/:idFin", async (req, res) => {
  const { idInicio, idFin } = req.params;

  try {
    const movimientos = await reporteService.getLotesConDetalleCompra(
      idInicio,
      idFin
    );
    res.json(movimientos);
  } catch (error) {
    console.error("Error fetching movimientos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/almacenes/compras/:proveedorId", async (req, res) => {
  const { proveedorId } = req.params;
  try {
    const compras = await reporteService.getComprasProveedor(proveedorId);
    res.json(compras);
  } catch (error) {
    console.error("Error fetching compras:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/caja/:idInicio/:idFin", async (req, res) => {
  const { idInicio, idFin } = req.params;
  try {
    const movimientos = await reporteService.getMovimientosCaja(
      idInicio,
      idFin
    );
    res.json(movimientos);
  } catch (error) {
    console.error("Error fetching movimientos de caja:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/ventas/cliente/:id_cliente", async (req, res) => {
  const { id_cliente } = req.params;

  try {
    const ventas = await reporteService.getVentasPorCliente(id_cliente);
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas for cliente:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/ventas/:idInicio/:idFin", async (req, res) => {
  const { idInicio, idFin } = req.params;

  try {
    const ventas = await reporteService.getVentas(idInicio, idFin);
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/ventas/clientes", async (req, res) => {
  try {
    const ventas = await reporteService.getVentasClientes();
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/ventas/clientes_por_puntos", async (req, res) => {
  try {
    const ventas = await reporteService.getTopClientesPorPuntos();
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/ventas/por_pagar", async (req, res) => {
  try {
    const ventas = await reporteService.getVentasPorPagar();
    res.json(ventas);
  } catch (error) {
    console.error("Error fetching ventas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/cliente/:id_cliente/total", async (req, res) => {
  const { id_cliente } = req.params;

  try {
    const totalGastado = await reporteService.getTotalGastadoPorCliente(
      id_cliente
    );
    res.json({ totalGastado });
  } catch (error) {
    console.error("Error fetching total gastado for cliente:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/producto/:id_producto/historial", async (req, res) => {
  const { id_producto } = req.params;

  try {
    const historial = await reporteService.obtenerHistorialProducto(
      id_producto
    );
    res.json({ historial });
  } catch (error) {
    console.error("Error al obtener el historial del producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

route.get("/mas-vendidos", async (req, res) => {
  try {
    const productos = await reporteService.obtenerProductosMasVendidos();
    res.json({ productos });
  } catch (error) {
    console.error("Error al obtener productos más vendidos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
module.exports = route;
