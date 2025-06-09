const Proveedor = require("../models/Proveedor");

class servicesProveedor {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los proveedores
  async getAllProveedores() {
    try {
      const proveedores = await Proveedor.findAll();
      return proveedores;
    } catch (error) {
      console.error("Error fetching all proveedores:", error);
      throw error;
    }
  }

  // Método GET para obtener un proveedor por id_proveedor
  async getProveedor(id_proveedor) {
    try {
      const proveedor = await Proveedor.findByPk(id_proveedor);
      if (!proveedor) {
        throw new Error(`Proveedor with ID ${id_proveedor} not found`);
      }
      return proveedor;
    } catch (error) {
      console.error("Error fetching proveedor:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo proveedor
  async createProveedor(data) {
    try {
      const newProveedor = await Proveedor.create(data);
      return newProveedor;
    } catch (error) {
      console.error("Error creating proveedor:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un proveedor por id_proveedor
  async updateProveedor(id_proveedor, data) {
    try {
      const proveedor = await Proveedor.findByPk(id_proveedor);
      if (!proveedor) {
        throw new Error(`Proveedor with ID ${id_proveedor} not found`);
      }
      await proveedor.update(data);
      return proveedor;
    } catch (error) {
      console.error("Error updating proveedor:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un proveedor por id_proveedor
  async deleteProveedor(id_proveedor) {
    try {
      const proveedor = await Proveedor.findByPk(id_proveedor);
      if (!proveedor) {
        throw new Error(`Proveedor with ID ${id_proveedor} not found`);
      }
      await proveedor.destroy();
      return { message: "Proveedor deleted successfully" };
    } catch (error) {
      console.error("Error deleting proveedor:", error);
      throw error;
    }
  }
}

module.exports = servicesProveedor;
