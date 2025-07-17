const { Sequelize } = require("sequelize");
const Producto = require("../models/Producto");
const Inventario = require("../models/Inventario");
const Lote = require("../models/Lote");
const MovimientoInventarioService = require("./servicesMovimientoInventario");
const InventarioService = require("./servicesInventario");
const sequelize = require("../libs/dbConexionORM");
const { DetalleCompra, MovimientoInventario, Proveedor } = require("../models");

const movimientoInventarioService = new MovimientoInventarioService();
const inventarioService = new InventarioService();

class servicesProducto {
  constructor() {
    this.sesion = {};
  }

  async getAllProducts() {
    try {
      const products = await Producto.findAll({
        include: {
          model: Lote,
          as: "lotes",
        },
        order: [["id_producto", "DESC"]],
      });
      return products;
    } catch (error) {
      console.error("Error fetching all products:", error);
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const product = await Producto.findByPk(id);
      if (!product) {
        throw new Error(`Product with ID ${id} not found`);
      }
      return product;
    } catch (error) {
      console.error("Error fetching product by ID:", error);
      throw error;
    }
  }

  async createProduct(data) {
    try {
      const newProduct = await Producto.create(data);
      return newProduct;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  async updateOneProduct(id, data) {
    try {
      const product = await Producto.findByPk(id);
      if (!product) {
        throw new Error(`producto with ID ${id} not found`);
      }
      await product.update(data);
      return product;
    } catch (error) {
      console.error("Error updating producto:", error);
      throw error;
    }
  }

  async updateProduct(id, data) {
    const transaction = await sequelize.transaction();

    try {
      const product = await Producto.findByPk(id, { transaction });
      if (!product) {
        throw new Error(`Product with ID ${id} not found`);
      }
      const stockChange =
        data.tipo_movimiento === "compra" ? data.cantidad : -data.cantidad;
      const pesoChange =
        data.tipo_movimiento === "compra"
          ? parseFloat(data.peso)
          : -parseFloat(data.peso);
      const subCantidadChange =
        data.tipo_movimiento === "compra"
          ? parseInt(data?.subCantidad)
          : -parseInt(data?.subCantidad);
      const currentPeso = product.peso !== null ? parseFloat(product.peso) : 0;
      const currentSubCantidad =
        product.subCantidad !== null ? parseInt(product.subCantidad) : 0;
      await product.update(
        {
          stock: product.stock + stockChange,
          peso: parseFloat((currentPeso + pesoChange).toFixed(2)),

          subCantidad: parseFloat(
            (currentSubCantidad + subCantidadChange).toFixed(2)
          ),
        },
        { transaction }
      );

      // Crear registro en MovimientoInventario
      const movimiento =
        await movimientoInventarioService.createMovimientoInventario(
          {
            id_producto: id,
            cantidad: data.cantidad,
            tipo_movimiento: data.tipo_movimiento,
            fecha_movimiento: new Date(),
            id_trabajador: data.id_trabajador,
          },
          transaction
        );

      // Crear registro en Inventario
      const inventario = await inventarioService.createInventario(
        {
          id_producto: id,
          id_lote: data.id_lote,
          cantidad: data.cantidad,
          subCantidad: data?.subCantidad,
          peso: parseFloat(data.peso).toFixed(2),
          fecha_actualizacion: new Date(),
          id_trabajador: data.id_trabajador,
        },
        transaction
      );

      await transaction.commit();

      return {
        producto: product,
        inventario,
        movimiento,
      };
    } catch (error) {
      await transaction.rollback();
      console.error("Error updating product:", error);
      throw error;
    }
  }

  async createDetalleCompraYLote(detalleCompraData, loteData) {
    const transaction = await sequelize.transaction();
    try {
      const newDetalleCompra = await DetalleCompra.create(detalleCompraData, {
        transaction,
      });
      const id_detalle_compra = newDetalleCompra.id_detalle;
      loteData.id_detalle_compra = id_detalle_compra;

      const newLote = await Lote.create(loteData, { transaction });

      await transaction.commit();
      return { newDetalleCompra, newLote };
    } catch (error) {
      await transaction.rollback();
      console.error("Error creando DetalleCompra y Lote:", error);
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const product = await Producto.findByPk(id);
      if (!product) {
        throw new Error(`Product with ID ${id} not found`);
      }
      await product.destroy();
      return { message: "Product deleted successfully" };
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  async getInventariosByProductId(id) {
    try {
      const product = await Producto.findByPk(id, {
        include: [
          {
            model: Inventario,
            as: "inventarios",
            include: [
              {
                model: Lote,
                as: "lote",
                include: [
                  {
                    model: DetalleCompra,
                    as: "detalleCompra",
                    include: {
                      model: Proveedor,
                      as: "proveedor",
                    },
                  },
                ],
              },
            ],
          },
          {
            model: MovimientoInventario,
            as: "movimientosInventario",
          },
        ],
        order: [
          [
            { model: Inventario, as: "inventarios" },
            { model: Lote, as: "lote" },
            "fecha_ingreso",
            "DESC",
          ],
        ],
      });

      if (!product) {
        throw new Error(`Product with ID ${id} not found`);
      }
      const inventarios = product.inventarios.map((inventario) => ({
        id_inventario: inventario.id_inventario,
        id_movimiento: product.movimientosInventario.id_movimiento,
        cantidad: inventario.cantidad,
        subCantidad: inventario.subCantidad,
        peso: inventario.peso,
        fecha_caducidad: inventario.lote
          ? inventario.lote.fecha_caducidad
          : null,
        fecha_ingreso: inventario.lote ? inventario.lote.fecha_ingreso : null,
        numero_lote: inventario.lote ? inventario.lote.numero_lote : null,
        precioVenta: inventario.lote ? inventario.lote.precioVenta : null,
        id_lote: inventario.lote ? inventario.lote.id_lote : null,
        cantidadPorCaja: inventario.lote
          ? inventario.lote.cantidadPorCaja
          : null,
        detalleCompra: inventario.lote ? inventario.lote.detalleCompra : null,
      }));

      return {
        producto: product.nombre,
        inventarios,
      };
    } catch (error) {
      console.error("Error fetching inventories by product ID:", error);
      throw error;
    }
  }

  async createDetalleCompraYLoteAndUpdateProduct(arrayData) {
    console.log(arrayData);

    const transaction = await sequelize.transaction();

    try {
      const results = [];

      for (const item of arrayData) {
        const newDetalleCompra = await DetalleCompra.create(
          item.detalleCompraData,
          {
            transaction,
          }
        );
        const id_detalle_compra = newDetalleCompra.id_detalle;

        const loteData = { ...item.loteData, id_detalle_compra };
        const newLote = await Lote.create(loteData, { transaction });

        await Lote.update(
          { precioVenta: newLote.precioVenta },
          {
            where: {
              id_producto: newLote.id_producto,
              id_lote: { [Sequelize.Op.ne]: newLote.id_lote },
            },
            transaction,
          }
        );

        const product = await Producto.findByPk(item.productId, {
          transaction,
        });
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const stockChange =
          item.productUpdateData.tipo_movimiento === "compra"
            ? item.productUpdateData.cantidad
            : -item.productUpdateData.cantidad;
        const pesoChange =
          item.productUpdateData.tipo_movimiento === "compra"
            ? parseFloat(item.productUpdateData.peso)
            : -parseFloat(item.productUpdateData.peso);
        const subCantidadChange =
          item.productUpdateData.tipo_movimiento === "compra"
            ? parseInt(item.productUpdateData.subCantidad)
            : -parseInt(item.productUpdateData.subCantidad);
        const currentPeso =
          product.peso !== null ? parseFloat(product.peso) : 0;
        const currentSubCantidad =
          product.subCantidad !== null ? parseInt(product.subCantidad) : 0;

        await product.update(
          {
            stock:
              parseInt(product.stock ? product.stock : 0) +
              parseInt(stockChange),
            //peso: parseFloat((currentPeso + pesoChange).toFixed(2)),
            subCantidad: parseFloat(
              (currentSubCantidad + subCantidadChange).toFixed(2)
            ),
          },
          { transaction }
        );
        const movimiento =
          await movimientoInventarioService.createMovimientoInventario(
            {
              id_producto: item.productId,
              cantidad: item.productUpdateData.cantidad,
              tipo_movimiento: item.productUpdateData.tipo_movimiento,
              fecha_movimiento: new Date(),
              id_trabajador: item.productUpdateData.id_trabajador,
              lote: newLote.id_lote,
            },
            transaction
          );
        const inventario = await inventarioService.createInventario(
          {
            id_producto: item.productId,
            id_lote: newLote.id_lote,
            cantidad: item.productUpdateData.cantidad,
            subCantidad: item.productUpdateData.subCantidad,
            peso: parseFloat(item.productUpdateData.peso).toFixed(2),
            fecha_actualizacion: new Date(),
            id_trabajador: item.productUpdateData.id_trabajador,
          },
          transaction
        );

        results.push({
          detalleCompra: newDetalleCompra,
          lote: newLote,
          producto: product,
          movimiento,
          inventario,
        });
      }

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      console.error("Error creando registros y actualizando producto:", error);
      throw error;
    }
  }
}

module.exports = servicesProducto;
