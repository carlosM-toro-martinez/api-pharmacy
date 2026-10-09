const { Op } = require("sequelize");
const { DateTime } = require("luxon");
const MovimientoInventario = require("../models/MovimientoInventario");
const {
  Sucursal,
  Producto,
  Trabajador,
} = require("../models");

const obtenerIdSucursalPrincipal = async (transaction = null) => {
  const marcadaPrincipal = await Sucursal.findOne({
    where: { es_principal: true, activo: true },
    order: [["id_sucursal", "ASC"]],
    transaction,
  });
  if (marcadaPrincipal) return marcadaPrincipal.id_sucursal;

  const [sucursal] = await Sucursal.findOrCreate({
    where: { nombre: "Sucursal principal" },
    defaults: {
      direccion: "Principal",
      es_principal: true,
      activo: true,
    },
    transaction,
  });
  return sucursal.id_sucursal;
};

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

  async getMovimientos(filters = {}) {
    // Compras y transferencias ya tienen su propio reporte dedicado; este es
    // solo para salidas manuales (mermas, ajustes, perdidas, etc).
    const where = { tipo_movimiento: "Salida sin venta" };
    const idSucursal = Number(filters.id_sucursal);
    if (idSucursal > 0) where.id_sucursal = idSucursal;

    if (filters.desde || filters.hasta) {
      where.fecha_movimiento = {};
      if (filters.desde) {
        where.fecha_movimiento[Op.gte] = DateTime.fromISO(filters.desde, {
          zone: "America/La_Paz",
        })
          .startOf("day")
          .toJSDate();
      }
      if (filters.hasta) {
        where.fecha_movimiento[Op.lte] = DateTime.fromISO(filters.hasta, {
          zone: "America/La_Paz",
        })
          .endOf("day")
          .toJSDate();
      }
    }

    const movimientos = await MovimientoInventario.findAll({
      where,
      include: [
        {
          model: Producto,
          as: "producto",
          attributes: [
            "id_producto",
            "nombre",
            "codigo_barra",
            "concentracion",
            "forma_farmaceutica",
          ],
        },
        { model: Sucursal, as: "sucursal", attributes: ["id_sucursal", "nombre"] },
        {
          model: Sucursal,
          as: "sucursalDestino",
          attributes: ["id_sucursal", "nombre"],
        },
        {
          model: Trabajador,
          as: "trabajadorMovimientoInventario",
          attributes: ["id_trabajador", "nombre", "apellido_paterno"],
        },
      ],
      order: [
        ["fecha_movimiento", "DESC"],
        ["id_movimiento", "DESC"],
      ],
      limit: 1000,
    });

    return movimientos;
  }

  async getTransferencias(filters = {}) {
    const where = {
      tipo_movimiento: "Transferencia salida",
    };
    const idSucursalOrigen = Number(filters.id_sucursal_origen);
    const idSucursalDestino = Number(filters.id_sucursal_destino);

    if (idSucursalOrigen > 0) where.id_sucursal = idSucursalOrigen;
    if (idSucursalDestino > 0) {
      where.id_sucursal_destino = idSucursalDestino;
    }

    if (filters.desde || filters.hasta) {
      where.fecha_movimiento = {};
      if (filters.desde) {
        where.fecha_movimiento[Op.gte] = DateTime.fromISO(filters.desde, {
          zone: "America/La_Paz",
        })
          .startOf("day")
          .toJSDate();
      }
      if (filters.hasta) {
        where.fecha_movimiento[Op.lte] = DateTime.fromISO(filters.hasta, {
          zone: "America/La_Paz",
        })
          .endOf("day")
          .toJSDate();
      }
    }

    const movimientos = await MovimientoInventario.findAll({
      where,
      include: [
        {
          model: Producto,
          as: "producto",
          attributes: [
            "id_producto",
            "nombre",
            "codigo_barra",
            "concentracion",
            "forma_farmaceutica",
          ],
        },
        { model: Sucursal, as: "sucursal", attributes: ["id_sucursal", "nombre"] },
        { model: Sucursal, as: "sucursalDestino", attributes: ["id_sucursal", "nombre"] },
        { model: Trabajador, as: "trabajadorMovimientoInventario", attributes: ["id_trabajador", "nombre", "apellido_paterno"] },
      ],
      order: [["fecha_movimiento", "DESC"], ["id_movimiento", "DESC"]],
    });

    return movimientos;
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
      let idSucursal = data?.id_sucursal;
      if (!idSucursal) {
        idSucursal = await obtenerIdSucursalPrincipal(transaction);
        console.error(
          `Creando MovimientoInventario sin id_sucursal (producto ${data?.id_producto}): se asumio la sucursal principal (${idSucursal}).`
        );
      }
      const newMovimiento = await MovimientoInventario.create(
        { ...data, id_sucursal: idSucursal },
        {
          transaction,
        }
      );
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
