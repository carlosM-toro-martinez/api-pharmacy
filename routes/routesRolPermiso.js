const express = require("express");
const RolPermisoService = require("../services/servicesRolPermiso");
const route = express.Router();

const rolPermisoService = new RolPermisoService();

// Ruta GET para obtener todas las relaciones Rol-Permiso
route.get("/", async (req, res) => {
  try {
    const rolPermisos = await rolPermisoService.getAllRolPermisos();
    res.json(rolPermisos);
  } catch (error) {
    console.error("Error fetching rol-permiso relations:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener una relación Rol-Permiso por id_rol e id_permiso
route.get("/:id_rol/:id_permiso", async (req, res) => {
  try {
    const { id_rol, id_permiso } = req.params;
    const rolPermiso = await rolPermisoService.getRolPermiso(
      id_rol,
      id_permiso
    );
    res.json(rolPermiso);
  } catch (error) {
    console.error("Error fetching rol-permiso relation:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear una nueva relación Rol-Permiso
route.post("/", async (req, res) => {
  try {
    const newRolPermiso = await rolPermisoService.createRolPermiso(req.body);
    res.status(201).json(newRolPermiso);
  } catch (error) {
    console.error("Error creating rol-permiso relation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta DELETE para eliminar una relación Rol-Permiso por id_rol e id_permiso
route.delete("/:id_rol/:id_permiso", async (req, res) => {
  try {
    const { id_rol, id_permiso } = req.params;
    const message = await rolPermisoService.deleteRolPermiso(
      id_rol,
      id_permiso
    );
    res.json(message);
  } catch (error) {
    console.error("Error deleting rol-permiso relation:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
