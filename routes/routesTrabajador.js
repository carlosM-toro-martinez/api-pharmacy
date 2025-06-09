const express = require("express");
const TrabajadorService = require("../services/servicesTrabajador");
const route = express.Router();

const trabajadorService = new TrabajadorService();

// Ruta GET para obtener todos los trabajadores
route.get("/", async (req, res) => {
  try {
    const trabajadores = await trabajadorService.getAllTrabajadores();
    res.json(trabajadores);
  } catch (error) {
    console.error("Error fetching trabajadores:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un trabajador por id_trabajador
route.get("/:id_trabajador", async (req, res) => {
  try {
    const { id_trabajador } = req.params;
    const trabajador = await trabajadorService.getTrabajador(id_trabajador);
    res.json(trabajador);
  } catch (error) {
    console.error("Error fetching trabajador:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo trabajador
route.post("/", async (req, res) => {
  try {
    const newTrabajador = await trabajadorService.createTrabajador(req.body);
    res.status(201).json(newTrabajador);
  } catch (error) {
    console.error("Error creating trabajador:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un trabajador por id_trabajador
route.put("/:id_trabajador", async (req, res) => {
  try {
    const { id_trabajador } = req.params;
    const updatedTrabajador = await trabajadorService.updateTrabajador(
      id_trabajador,
      req.body
    );
    res.json(updatedTrabajador);
  } catch (error) {
    console.error("Error updating trabajador:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un trabajador por id_trabajador
route.delete("/:id_trabajador", async (req, res) => {
  try {
    const { id_trabajador } = req.params;
    const message = await trabajadorService.deleteTrabajador(id_trabajador);
    res.json(message);
  } catch (error) {
    console.error("Error deleting trabajador:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
