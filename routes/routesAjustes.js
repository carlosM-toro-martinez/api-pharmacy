const express = require("express");
const AjustesService = require("../services/servicesAjustes");
const route = express.Router();

const ajustesService = new AjustesService();

route.get("/auditoria-stock", async (req, res) => {
  try {
    const auditoria = await ajustesService.auditarStock();
    res.json(auditoria);
  } catch (error) {
    console.error("Error auditando stock:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/resumen", async (req, res) => {
  try {
    const resumen = await ajustesService.resumenAuditoria();
    res.json(resumen);
  } catch (error) {
    console.error("Error obteniendo resumen de ajustes:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/mantenimiento", async (req, res) => {
  try {
    const resumen = await ajustesService.resumenMantenimiento();
    res.json(resumen);
  } catch (error) {
    console.error("Error obteniendo resumen de mantenimiento:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/registros-vacios", async (req, res) => {
  try {
    const resultado = await ajustesService.revisarRegistrosVacios();
    res.json(resultado);
  } catch (error) {
    console.error("Error revisando registros vacios:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/inventarios-huerfanos", async (req, res) => {
  try {
    const huerfanos = await ajustesService.auditarInventariosHuerfanos();
    res.json(huerfanos);
  } catch (error) {
    console.error("Error auditando inventarios huerfanos:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/descuadre-stock", async (req, res) => {
  try {
    const descuadre = await ajustesService.auditarDescuadreStock();
    res.json(descuadre);
  } catch (error) {
    console.error("Error auditando descuadre de stock:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/lotes-sobrevendidos", async (req, res) => {
  try {
    const sobrevendidos = await ajustesService.auditarLotesSobrevendidos();
    res.json(sobrevendidos);
  } catch (error) {
    console.error("Error auditando lotes sobrevendidos:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/inventarios-negativos", async (req, res) => {
  try {
    const negativos = await ajustesService.auditarInventariosNegativos();
    res.json(negativos);
  } catch (error) {
    console.error("Error auditando inventarios negativos:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/compras-duplicadas", async (req, res) => {
  try {
    const duplicadas = await ajustesService.auditarComprasDuplicadas();
    res.json(duplicadas);
  } catch (error) {
    console.error("Error auditando compras duplicadas:", error);
    res.status(500).json({ error: error.message });
  }
});

route.get("/movimientos-duplicados", async (req, res) => {
  try {
    const duplicados = await ajustesService.auditarMovimientosDuplicados();
    res.json(duplicados);
  } catch (error) {
    console.error("Error auditando movimientos duplicados:", error);
    res.status(500).json({ error: error.message });
  }
});

route.post("/sincronizar-stock", async (req, res) => {
  try {
    const resultado = await ajustesService.sincronizarTodosLosStocks();
    res.json(resultado);
  } catch (error) {
    console.error("Error sincronizando stocks:", error);
    res.status(500).json({ error: error.message });
  }
});

route.post("/sincronizar-stock/:id_producto", async (req, res) => {
  try {
    const resultado = await ajustesService.sincronizarStockProducto(
      req.params.id_producto
    );
    res.json(resultado);
  } catch (error) {
    console.error("Error sincronizando stock de producto:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = route;
