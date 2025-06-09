const express = require("express");
const LoteService = require("../services/servicesLote");
const route = express.Router();

const loteService = new LoteService();

// Ruta GET para obtener todos los lotes
route.get("/", async (req, res) => {
  try {
    const lotes = await loteService.getAllLotes();
    res.json(lotes);
  } catch (error) {
    console.error("Error fetching lotes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener los 10 productos mas cerca de vencerse
route.get("/proximos_vencidos", async (req, res) => {
  try {
    const lotes = await loteService.getTop20LotesPorVencer();
    res.json(lotes);
  } catch (error) {
    console.error("Error fetching lotes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un lote por id_lote
route.get("/:id_lote", async (req, res) => {
  try {
    const { id_lote } = req.params;
    const lote = await loteService.getLote(id_lote);
    res.json(lote);
  } catch (error) {
    console.error("Error fetching lote:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo lote
route.post("/", async (req, res) => {
  try {
    const newLote = await loteService.createLote(req.body);
    res.status(201).json(newLote);
  } catch (error) {
    console.error("Error creating lote:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un lote por id_lote
route.put("/:id_lote", async (req, res) => {
  try {
    const { id_lote } = req.params;
    const updatedLote = await loteService.updateLote(id_lote, req.body);
    res.json(updatedLote);
  } catch (error) {
    console.error("Error updating lote:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un lote por id_lote
route.delete("/:id_lote", async (req, res) => {
  try {
    const { id_lote } = req.params;
    const message = await loteService.deleteLote(id_lote);
    res.json(message);
  } catch (error) {
    console.error("Error deleting lote:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
