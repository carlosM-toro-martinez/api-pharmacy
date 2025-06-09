const express = require("express");
const RolService = require("../services/servicesRol");
const route = express.Router();

const rolService = new RolService();

// Ruta GET para obtener todos los roles
route.get("/", async (req, res) => {
  try {
    const roles = await rolService.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un rol por ID
route.get("/:id", async (req, res) => {
  try {
    const role = await rolService.getRoleById(req.params.id);
    res.json(role);
  } catch (error) {
    console.error("Error fetching role by ID:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo rol con permisos
route.post("/", async (req, res) => {
  try {
    const { nombre, permisos } = req.body;
    const newRole = await rolService.createRole({ nombre, permisos });
    res.status(201).json(newRole);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un rol por ID
route.put("/:id", async (req, res) => {
  try {
    const updatedRole = await rolService.updateRole(req.params.id, req.body);
    res.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un rol por ID
route.delete("/:id", async (req, res) => {
  try {
    const message = await rolService.deleteRole(req.params.id);
    res.json(message);
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
