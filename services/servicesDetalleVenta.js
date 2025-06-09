const DetalleVenta = require("../models/DetalleVenta");

class servicesDetalleVenta {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los detalles de venta
  async getAllDetallesVenta() {
    try {
      const detallesVenta = await DetalleVenta.findAll();
      return detallesVenta;
    } catch (error) {
      console.error("Error fetching all detallesVenta:", error);
      throw error;
    }
  }

  // Método GET para obtener un detalle de venta por id_detalle
  async getDetalleVenta(id_detalle) {
    try {
      const detalleVenta = await DetalleVenta.findByPk(id_detalle);
      if (!detalleVenta) {
        throw new Error(`DetalleVenta with ID ${id_detalle} not found`);
      }
      return detalleVenta;
    } catch (error) {
      console.error("Error fetching detalleVenta:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo detalle de venta
  async createDetalleVenta(data) {
    try {
      const newDetalleVenta = await DetalleVenta.create(data);
      return newDetalleVenta;
    } catch (error) {
      console.error("Error creating detalleVenta:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un detalle de venta por id_detalle
  async updateDetalleVenta(id_detalle, data) {
    try {
      const detalleVenta = await DetalleVenta.findByPk(id_detalle);
      if (!detalleVenta) {
        throw new Error(`DetalleVenta with ID ${id_detalle} not found`);
      }
      await detalleVenta.update(data);
      return detalleVenta;
    } catch (error) {
      console.error("Error updating detalleVenta:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un detalle de venta por id_detalle
  async deleteDetalleVenta(id_detalle) {
    try {
      const detalleVenta = await DetalleVenta.findByPk(id_detalle);
      if (!detalleVenta) {
        throw new Error(`DetalleVenta with ID ${id_detalle} not found`);
      }
      await detalleVenta.destroy();
      return { message: "DetalleVenta deleted successfully" };
    } catch (error) {
      console.error("Error deleting detalleVenta:", error);
      throw error;
    }
  }
}

module.exports = servicesDetalleVenta;
