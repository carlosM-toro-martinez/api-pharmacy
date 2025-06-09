const MetodoVenta = require("../models/MetodoVenta");

class servicesMetodoVenta {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los métodos de venta
  async getAllMetodosVenta() {
    try {
      const metodosVenta = await MetodoVenta.findAll();
      return metodosVenta;
    } catch (error) {
      console.error("Error fetching all metodos de venta:", error);
      throw error;
    }
  }

  // Método GET para obtener un método de venta por id_metodo_venta
  async getMetodoVentaByProducto(id_producto) {
    try {
      const metodoVenta = await MetodoVenta.findAll({
        where: { id_producto: id_producto },
      });
      if (!metodoVenta || metodoVenta.length === 0) {
        throw new Error(
          `No se encontraron métodos de venta para el ID de producto ${id_producto}`
        );
      }
      return metodoVenta;
    } catch (error) {
      console.error("Error fetching metodo de venta:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo método de venta
  async createMetodoVenta(data) {
    try {
      const newMetodoVenta = await MetodoVenta.create(data);
      return newMetodoVenta;
    } catch (error) {
      console.error("Error creating metodo de venta:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un método de venta por id_metodo_venta
  async updateMetodoVenta(id_metodo_venta, data) {
    try {
      const metodoVenta = await MetodoVenta.findByPk(id_metodo_venta);
      if (!metodoVenta) {
        throw new Error(`Metodo de venta with ID ${id_metodo_venta} not found`);
      }
      await metodoVenta.update(data);
      return metodoVenta;
    } catch (error) {
      console.error("Error updating metodo de venta:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un método de venta por id_metodo_venta
  async deleteMetodoVenta(id_metodo_venta) {
    try {
      const metodoVenta = await MetodoVenta.findByPk(id_metodo_venta);
      if (!metodoVenta) {
        throw new Error(`Metodo de venta with ID ${id_metodo_venta} not found`);
      }
      await metodoVenta.destroy();
      return { message: "Metodo de venta deleted successfully" };
    } catch (error) {
      console.error("Error deleting metodo de venta:", error);
      throw error;
    }
  }
}

module.exports = servicesMetodoVenta;
