const MovimientoInventario = require("../models/MovimientoInventario");

class servicesMovimientoInventario {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los movimientos de inventario
  async getAllMovimientosInventario() {
    try {
      const movimientos = await MovimientoInventario.findAll();
      return movimientos;
    } catch (error) {
      console.error("Error fetching all movimientosInventario:", error);
      throw error;
    }
  }

  // Método GET para obtener un movimiento de inventario por id_movimiento
  async getMovimientoInventario(id_movimiento) {
    try {
      const movimiento = await MovimientoInventario.findByPk(id_movimiento);
      if (!movimiento) {
        throw new Error(
          `MovimientoInventario with ID ${id_movimiento} not found`
        );
      }
      return movimiento;
    } catch (error) {
      console.error("Error fetching movimientoInventario:", error);
      throw error;
    }
  }

  async createMovimientoInventario(data, transaction = null) {
    try {
      const newMovimiento = await MovimientoInventario.create(data, {
        transaction,
      });
      return newMovimiento;
    } catch (error) {
      console.error("Error creating movimientoInventario:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un movimiento de inventario por id_movimiento
  async updateMovimientoInventario(id_movimiento, data) {
    try {
      const movimiento = await MovimientoInventario.findByPk(id_movimiento);
      if (!movimiento) {
        throw new Error(
          `MovimientoInventario with ID ${id_movimiento} not found`
        );
      }
      await movimiento.update(data);
      return movimiento;
    } catch (error) {
      console.error("Error updating movimientoInventario:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un movimiento de inventario por id_movimiento
  async deleteMovimientoInventario(id_movimiento) {
    try {
      const movimiento = await MovimientoInventario.findByPk(id_movimiento);
      if (!movimiento) {
        throw new Error(
          `MovimientoInventario with ID ${id_movimiento} not found`
        );
      }
      await movimiento.destroy();
      return { message: "MovimientoInventario deleted successfully" };
    } catch (error) {
      console.error("Error deleting movimientoInventario:", error);
      throw error;
    }
  }
}

module.exports = servicesMovimientoInventario;
