const { Sequelize } = require("sequelize");
const { Inventario, MovimientoInventario } = require("../models");
const DetalleCompra = require("../models/DetalleCompra");
const Lote = require("../models/Lote");
const Producto = require("../models/Producto");
const Proveedor = require("../models/Proveedor");
const sequelize = require("../libs/dbConexionORM");

class servicesDetalleCompra {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los detalles de compra
  async getAllDetallesCompra() {
    try {
      const detallesCompra = await DetalleCompra.findAll();
      return detallesCompra;
    } catch (error) {
      console.error("Error fetching all detalles de compra:", error);
      throw error;
    }
  }

  async getDetallesCompraByLote(numeroLote) {
    try {
      const detallesCompra = await Lote.findAll({
        where: { numero_lote: numeroLote },
        include: [
          {
            model: Producto,
            as: "producto",
            attributes: ["nombre", "id_producto"],
          },
          {
            model: DetalleCompra,
            as: "detalleCompra",
            include: [
              {
                model: Proveedor,
                as: "proveedor",
                attributes: ["nombre", "id_proveedor"],
              },
            ],
            attributes: ["precio_unitario", "id_detalle"],
          },
          {
            model: Inventario,
            as: "inventarios",
          },
        ],
        attributes: [
          "id_lote",
          "numero_lote",
          "fecha_caducidad",
          "cantidad",
          "peso",
          "subCantidad",
        ],
      });

      return detallesCompra;
    } catch (error) {
      console.error("Error fetching detalles de compra by lote:", error);
      throw error;
    }
  }

  async getDetalleCompra(id_detalle) {
    try {
      const detalleCompra = await DetalleCompra.findByPk(id_detalle);
      if (!detalleCompra) {
        throw new Error(`DetalleCompra with ID ${id_detalle} not found`);
      }
      return detalleCompra;
    } catch (error) {
      console.error("Error fetching detalle de compra:", error);
      throw error;
    }
  }

  async createDetalleCompra(data) {
    try {
      if (!data.id_producto) {
        throw new Error(
          "El campo 'id_producto' es obligatorio y debe ser un número válido."
        );
      }
      const newDetalleCompra = await DetalleCompra.create(data);
      return newDetalleCompra;
    } catch (error) {
      console.error("Error creating detalle de compra:", error);
      throw error;
    }
  }

  async updateDetalleCompra(id_detalle, data) {
    try {
      console.log(data);

      const detalleCompra = await DetalleCompra.findByPk(id_detalle);
      if (!detalleCompra) {
        throw new Error(`DetalleCompra with ID ${id_detalle} not found`);
      }

      const { precio_unitario, precioVenta, id_lote, id_proveedor } = data;

      if (precio_unitario !== undefined && id_proveedor !== undefined) {
        await detalleCompra.update({ precio_unitario, id_proveedor });
      }

      if (precioVenta !== undefined && id_lote) {
        const lote = await Lote.findByPk(id_lote);
        if (!lote) {
          throw new Error(`Lote with ID ${id_lote} not found`);
        }

        await lote.update({ precioVenta });
      }

      return detalleCompra;
    } catch (error) {
      console.error("Error updating detalle de compra o lote:", error);
      throw error;
    }
  }

  // async deleteDetalleCompra(id_detalle) {
  //   try {
  //     const detalleCompra = await DetalleCompra.findByPk(id_detalle);
  //     if (!detalleCompra) {
  //       throw new Error(`DetalleCompra with ID ${id_detalle} not found`);
  //     }
  //     await detalleCompra.destroy();
  //     return { message: "DetalleCompra deleted successfully" };
  //   } catch (error) {
  //     console.error("Error deleting detalle de compra:", error);
  //     throw error;
  //   }
  // }

  async eliminarInventarioYActualizarProducto(detalle) {
    const transaction = await sequelize.transaction();

    try {
      const {
        id_producto,
        id_lote,
        id_inventario,
        id_movimiento,
        id_detalle,
        cantidad,
        subCantidad,
        peso,
      } = detalle;

      const productoModificaciones = {};

      try {
        // Eliminar inventario
        const inventario = await Inventario.findByPk(id_inventario, {
          transaction,
        });

        if (inventario) {
          await inventario.destroy({ transaction });
        } else {
          console.warn(`No se encontró el inventario con ID ${id_inventario}.`);
        }

        // Eliminar movimiento de inventario
        const movimiento = await MovimientoInventario.findByPk(id_movimiento, {
          transaction,
        });

        if (movimiento) {
          await movimiento.destroy({ transaction });
        } else {
          console.warn(
            `No se encontró el MovimientoInventario con ID ${id_movimiento}.`
          );
        }

        // Eliminar lote
        const lote = await Lote.findByPk(id_lote, {
          transaction,
        });

        if (lote) {
          await lote.destroy({ transaction });
        } else {
          console.warn(`No se encontró el lote con ID ${id_lote}.`);
        }

        // Eliminar detalle de compra
        const detalleCompra = await DetalleCompra.findByPk(id_detalle, {
          transaction,
        });

        if (detalleCompra) {
          await detalleCompra.destroy({ transaction });
        } else {
          console.warn(`No se encontró el DetalleCompra con ID ${id_detalle}.`);
        }

        // Actualizar producto
        if (!productoModificaciones[id_producto]) {
          const producto = await Producto.findByPk(id_producto, {
            transaction,
          });

          if (producto) {
            productoModificaciones[id_producto] = {
              producto,
              stock: producto.stock,
              subCantidad: producto.subCantidad,
              peso: producto.peso,
            };
          } else {
            console.warn(
              `Producto no encontrado (ID Producto: ${id_producto}).`
            );
          }
        }

        if (productoModificaciones[id_producto]) {
          productoModificaciones[id_producto].stock -= cantidad || 0;
          productoModificaciones[id_producto].subCantidad -= subCantidad || 0;
          productoModificaciones[id_producto].peso -= parseFloat(peso) || 0;
        }
      } catch (error) {
        console.error(`Error al procesar el detalle: ${error.message}`);
      }

      // Guardar actualizaciones del producto
      for (const mod of Object.values(productoModificaciones)) {
        try {
          await mod.producto.update(
            {
              stock: mod.stock,
              subCantidad: mod.subCantidad,
              peso: mod.peso,
            },
            { transaction }
          );
        } catch (error) {
          console.error(
            `Error al actualizar el producto con ID ${mod.producto.id}: ${error.message}`
          );
        }
      }

      // Confirmar transacción
      await transaction.commit();

      return {
        message:
          "El inventario y los registros relacionados fueron eliminados exitosamente.",
      };
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback();
      console.error(`Error general: ${error.message}`);
      throw new Error("Ocurrió un error al eliminar el inventario.");
    }
  }
}

module.exports = servicesDetalleCompra;
