const express = require("express");
const ProductService = require("../services/servicesProduct");
const route = express.Router();

const productService = new ProductService();

// Ruta GET para obtener todos los productos
route.get("/", async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un producto por ID
route.get("/:id", async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.json(product);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    res.status(404).json({ error: error.message });
  }
});

route.get("/:id/inventarios", async (req, res) => {
  try {
    const result = await productService.getInventariosByProductId(
      req.params.id
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching inventories by product ID:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo producto
route.post("/", async (req, res) => {
  try {
    const newProduct = await productService.createProduct(req.body);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta POST para crear un nuevo producto
route.post("/buy", async (req, res) => {
  try {
    const newProduct =
      await productService.createDetalleCompraYLoteAndUpdateProduct(req.body);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un producto por ID
route.put("/:id", async (req, res) => {
  try {
    const updatedProduct = await productService.updateProduct(
      req.params.id,
      req.body
    );
    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(404).json({ error: error.message });
  }
});

route.put("/updateOne/:id", async (req, res) => {
  try {
    const updatedProduct = await productService.updateOneProduct(
      req.params.id,
      req.body
    );
    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un producto por ID
route.delete("/:id", async (req, res) => {
  try {
    const message = await productService.deleteProduct(req.params.id);
    res.json(message);
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
