const express = require("express");
const SucursalService = require("../services/servicesSucursal");

const route = express.Router();
const sucursalService = new SucursalService();

route.get("/", async (req, res) => {
  try {
    const sucursales = await sucursalService.getAllSucursales();
    res.json(sucursales);
  } catch (error) {
    console.error("Error obteniendo sucursales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/principal", async (req, res) => {
  try {
    const sucursal = await sucursalService.obtenerSucursalPrincipal();
    res.json(sucursal);
  } catch (error) {
    console.error("Error obteniendo sucursal principal:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.post("/", async (req, res) => {
  try {
    const sucursal = await sucursalService.createSucursal(req.body);
    res.status(201).json(sucursal);
  } catch (error) {
    console.error("Error creando sucursal:", error);
    res.status(400).json({ error: error.message });
  }
});

route.put("/:id_sucursal", async (req, res) => {
  try {
    const sucursal = await sucursalService.updateSucursal(
      req.params.id_sucursal,
      req.body
    );
    res.json(sucursal);
  } catch (error) {
    console.error("Error actualizando sucursal:", error);
    res.status(400).json({ error: error.message });
  }
});

route.delete("/:id_sucursal", async (req, res) => {
  try {
    const resultado = await sucursalService.eliminarSucursal(
      req.params.id_sucursal
    );
    res.json(resultado);
  } catch (error) {
    console.error("Error eliminando sucursal:", error);
    res.status(400).json({ error: error.message });
  }
});

route.post("/:id_sucursal/principal", async (req, res) => {
  try {
    const sucursal = await sucursalService.marcarPrincipal(
      req.params.id_sucursal
    );
    res.json(sucursal);
  } catch (error) {
    console.error("Error marcando sucursal principal:", error);
    res.status(400).json({ error: error.message });
  }
});

route.post("/transferir", async (req, res) => {
  try {
    const resultado = Array.isArray(req.body?.items)
      ? await sucursalService.transferirInventarios(req.body)
      : await sucursalService.transferirInventario(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    console.error("Error transfiriendo inventario:", error);
    res.status(400).json({ error: error.message });
  }
});

route.post("/stock-inicial", async (req, res) => {
  try {
    const resultado = await sucursalService.cargarStockInicial(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    console.error("Error cargando stock inicial:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = route;
