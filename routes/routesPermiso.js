const express = require("express");
const PermisoService = require("../services/servicesPermiso");
const route = express.Router();

const permisoService = new PermisoService();

// Ruta GET para obtener todos los permisos
route.get("/", async (req, res) => {
  try {
    const permisos = await permisoService.getAllPermisos();
    res.json(permisos);
  } catch (error) {
    console.error("Error fetching permisos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un permiso por ID
route.get("/:id", async (req, res) => {
  try {
    const permiso = await permisoService.getPermisoById(req.params.id);
    res.json(permiso);
  } catch (error) {
    console.error("Error fetching permiso by ID:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo permiso
route.post("/", async (req, res) => {
  try {
    const newPermiso = await permisoService.createPermiso(req.body);
    res.status(201).json(newPermiso);
  } catch (error) {
    console.error("Error creating permiso:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un permiso por ID
route.put("/:id", async (req, res) => {
  try {
    const updatedPermiso = await permisoService.updatePermiso(
      req.params.id,
      req.body
    );
    res.json(updatedPermiso);
  } catch (error) {
    console.error("Error updating permiso:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un permiso por ID
route.delete("/:id", async (req, res) => {
  try {
    const message = await permisoService.deletePermiso(req.params.id);
    res.json(message);
  } catch (error) {
    console.error("Error deleting permiso:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
