const express = require("express");
const ClienteService = require("../services/servicesCliente");
const route = express.Router();

const clienteService = new ClienteService();

// Ruta GET para obtener todos los clientes
route.get("/", async (req, res) => {
  try {
    const clientes = await clienteService.getAllClientes();
    res.json(clientes);
  } catch (error) {
    console.error("Error fetching clientes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un cliente por id_cliente
route.get("/:id_cliente", async (req, res) => {
  try {
    const { id_cliente } = req.params;
    const cliente = await clienteService.getCliente(id_cliente);
    res.json(cliente);
  } catch (error) {
    console.error("Error fetching cliente:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un nuevo cliente
route.post("/", async (req, res) => {
  try {
    const newCliente = await clienteService.createCliente(req.body);
    res.status(201).json(newCliente);
  } catch (error) {
    console.error("Error creating cliente:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta PUT para actualizar un cliente por id_cliente
route.put("/:id_cliente", async (req, res) => {
  try {
    const { id_cliente } = req.params;
    const updatedCliente = await clienteService.updateCliente(
      id_cliente,
      req.body
    );
    res.json(updatedCliente);
  } catch (error) {
    console.error("Error updating cliente:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un cliente por id_cliente
route.delete("/:id_cliente", async (req, res) => {
  try {
    const { id_cliente } = req.params;
    const message = await clienteService.deleteCliente(id_cliente);
    res.json(message);
  } catch (error) {
    console.error("Error deleting cliente:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
