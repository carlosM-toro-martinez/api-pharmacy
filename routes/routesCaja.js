const express = require("express");
const CajaService = require("../services/servicesCaja");
const route = express.Router();

const cajaService = new CajaService();

route.post("/abrir", async (req, res) => {
  try {
    const { monto_inicial, id_trabajador } = req.body;
    const nuevaCaja = await cajaService.abrirCaja(monto_inicial, id_trabajador);
    res.status(201).json(nuevaCaja);
  } catch (error) {
    console.error("Error opening caja:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.post("/cerrar", async (req, res) => {
  try {
    const { id_caja, id_trabajador } = req.body;
    const cajaCerrada = await cajaService.cerrarCaja(id_caja, id_trabajador);
    res.status(200).json(cajaCerrada);
  } catch (error) {
    console.error("Error closing caja:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/", async (req, res) => {
  try {
    const cajas = await cajaService.getLastCaja();

    if (cajas.length === 0) {
      return res.json({});
    }

    res.json(cajas);
  } catch (error) {
    console.error("Error fetching cajas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/all", async (req, res) => {
  try {
    const cajas = await cajaService.getAllCajas();
    res.json(cajas);
  } catch (error) {
    console.error("Error fetching cajas:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.get("/:id_caja", async (req, res) => {
  try {
    const { id_caja } = req.params;
    const caja = await cajaService.getCaja(id_caja);
    res.json(caja);
  } catch (error) {
    console.error("Error fetching caja:", error);
    res.status(404).json({ error: error.message });
  }
});

route.post("/", async (req, res) => {
  try {
    const newCaja = await cajaService.createCaja(req.body);
    res.status(201).json(newCaja);
  } catch (error) {
    console.error("Error creating caja:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

route.put("/:id_caja", async (req, res) => {
  try {
    const { id_caja } = req.params;
    const updatedCaja = await cajaService.updateCaja(id_caja, req.body);
    res.json(updatedCaja);
  } catch (error) {
    console.error("Error updating caja:", error);
    res.status(404).json({ error: error.message });
  }
});

route.delete("/:id_caja", async (req, res) => {
  try {
    const { id_caja } = req.params;
    const message = await cajaService.deleteCaja(id_caja);
    res.json(message);
  } catch (error) {
    console.error("Error deleting caja:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
