const express = require("express");
const CategoriaService = require("../services/servicesCategoria");
const route = express.Router();

const categoriaService = new CategoriaService();

// Ruta GET para obtener todas las categorías
route.get("/", async (req, res) => {
  try {
    const categorias = await categoriaService.getAllCategorias();
    res.json(categorias);
  } catch (error) {
    console.error("Error fetching categorias:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener una categoría por id_categoria
route.get("/:id_categoria", async (req, res) => {
  try {
    const { id_categoria } = req.params;
    const categoria = await categoriaService.getCategoria(id_categoria);
    res.json(categoria);
  } catch (error) {
    console.error("Error fetching categoria:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear una nueva categoría
route.post("/", async (req, res) => {
  try {
    const newCategoria = await categoriaService.createCategoria(req.body);
    res.status(201).json(newCategoria);
  } catch (error) {
    console.error("Error creating categoria:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar una categoría por id_categoria
route.put("/:id_categoria", async (req, res) => {
  try {
    const { id_categoria } = req.params;
    const updatedCategoria = await categoriaService.updateCategoria(
      id_categoria,
      req.body
    );
    res.json(updatedCategoria);
  } catch (error) {
    console.error("Error updating categoria:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar una categoría por id_categoria
route.delete("/:id_categoria", async (req, res) => {
  try {
    const { id_categoria } = req.params;
    const message = await categoriaService.deleteCategoria(id_categoria);
    res.json(message);
  } catch (error) {
    console.error("Error deleting categoria:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
