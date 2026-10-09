const { Sequelize, Op } = require("sequelize");
const { Inventario, MovimientoInventario } = require("../models");
const DetalleCompra = require("../models/DetalleCompra");
const Lote = require("../models/Lote");
const Producto = require("../models/Producto");
const Proveedor = require("../models/Proveedor");
const sequelize = require("../libs/dbConexionORM");
const AjustesService = require("./servicesAjustes");
const { getNowLapaz } = require("../utils/dateUtils");

const ajustesService = new AjustesService();

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
            where: {
              activo: {
                [Op.ne]: false,
              },
            },
            required: true,
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
      const { precio_unitario, precioVenta, id_lote, id_proveedor, id_producto } =
        data;
      let detalleCompra = null;
      const idDetalleNum = Number(id_detalle);

      const editaCompraOProveedor =
        precio_unitario !== undefined || id_proveedor !== undefined;

      if (editaCompraOProveedor) {
        if (idDetalleNum) {
          detalleCompra = await DetalleCompra.findByPk(idDetalleNum);
        }

        if (detalleCompra) {
          const payload = {};
          if (precio_unitario !== undefined) payload.precio_unitario = precio_unitario;
          if (id_proveedor !== undefined) payload.id_proveedor = id_proveedor;
          await detalleCompra.update(payload);
        } else if (id_lote) {
          // Este lote no tenia todavia un DetalleCompra (ej. viene de stock
          // inicial o de una transferencia sin costo/proveedor): se crea uno
          // nuevo y se vincula al lote, en vez de descartar en silencio lo
          // que se esta editando.
          const lote = await Lote.findByPk(id_lote);
          if (!lote) {
            throw new Error(`Lote with ID ${id_lote} not found`);
          }
          detalleCompra = await DetalleCompra.create({
            id_producto: id_producto || lote.id_producto,
            id_proveedor: id_proveedor || null,
            cantidad: lote.cantidad,
            subCantidad: lote.subCantidad,
            precio_unitario: precio_unitario ?? null,
            peso: lote.peso || 0,
            fecha_compra: getNowLapaz(),
          });
          await lote.update({ id_detalle_compra: detalleCompra.id_detalle });
        }
      }

      if (precioVenta !== undefined && id_lote) {
        const lote = await Lote.findByPk(id_lote);
        if (!lote) {
          throw new Error(`Lote with ID ${id_lote} not found`);
        }

        // El precio de venta es del producto, no de un lote/sucursal en
        // particular: se comparte en todos los lotes del producto (todas
        // las sucursales), igual que ya ocurre al registrar una compra.
        await Lote.update(
          { precioVenta },
          { where: { id_producto: lote.id_producto } }
        );
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
      const productosAfectados = new Set([id_producto]);

      {
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
      }

      // Guardar actualizaciones del producto. Antes, un error aca (o en
      // cualquiera de los pasos de arriba) se registraba en el log y se
      // IGNORABA, dejando que la transaccion igual hiciera commit — podia
      // reportar "eliminado exitosamente" habiendo borrado solo parte de
      // los registros (ej. el Inventario pero no el Lote), o sin aplicar
      // el ajuste al stock del producto. Ahora un error aca revienta hacia
      // el catch de afuera, que hace rollback de todo.
      for (const mod of Object.values(productoModificaciones)) {
        await mod.producto.update(
          {
            stock: mod.stock,
            subCantidad: mod.subCantidad,
            peso: mod.peso,
          },
          { transaction }
        );
      }

      for (const idProducto of productosAfectados) {
        await ajustesService.sincronizarStockProducto(idProducto, transaction);
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
