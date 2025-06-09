const Cliente = require("../models/Cliente");

class servicesCliente {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los clientes
  async getAllClientes() {
    try {
      const clientes = await Cliente.findAll({
        where: {
          estado: true,
        },
      });
      return clientes;
    } catch (error) {
      console.error("Error fetching all active clientes:", error);
      throw error;
    }
  }

  // Método GET para obtener un cliente por id_cliente
  async getCliente(id_cliente) {
    try {
      const cliente = await Cliente.findByPk(id_cliente);
      if (!cliente) {
        throw new Error(`Cliente with ID ${id_cliente} not found`);
      }
      return cliente;
    } catch (error) {
      console.error("Error fetching cliente:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo cliente
  async createCliente(data) {
    try {
      const newCliente = await Cliente.create(data);
      return newCliente;
    } catch (error) {
      console.error("Error creating cliente:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un cliente por id_cliente
  async updateCliente(id_cliente, data) {
    try {
      const cliente = await Cliente.findByPk(id_cliente);
      if (!cliente) {
        throw new Error(`Cliente with ID ${id_cliente} not found`);
      }
      await cliente.update(data);
      return cliente;
    } catch (error) {
      console.error("Error updating cliente:", error);
      throw error;
    }
  }

  async deleteCliente(id_cliente) {
    try {
      const cliente = await Cliente.findByPk(id_cliente);
      if (!cliente) {
        throw new Error(`Cliente with ID ${id_cliente} not found`);
      }
      // Cambiar el estado a false en lugar de eliminar
      await cliente.update({ estado: false });
      return { message: "Cliente marked as inactive (estado: false)" };
    } catch (error) {
      console.error("Error updating cliente's estado:", error);
      throw error;
    }
  }
}

module.exports = servicesCliente;
