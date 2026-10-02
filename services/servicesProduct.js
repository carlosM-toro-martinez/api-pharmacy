const { Sequelize, Op, QueryTypes } = require("sequelize");
const Producto = require("../models/Producto");
const Inventario = require("../models/Inventario");
const Lote = require("../models/Lote");
const MovimientoInventarioService = require("./servicesMovimientoInventario");
const InventarioService = require("./servicesInventario");
const AjustesService = require("./servicesAjustes");
const sequelize = require("../libs/dbConexionORM");
const { DetalleCompra, MovimientoInventario, Proveedor } = require("../models");
const { getNowLapaz } = require("../utils/dateUtils");

const movimientoInventarioService = new MovimientoInventarioService();
const inventarioService = new InventarioService();
const ajustesService = new AjustesService();
const comprasEnProceso = new Set();
const comprasProcesadas = new Map();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const buildCompraKey = (arrayData) =>
  JSON.stringify(
    arrayData.map((item) => ({
      producto: item.detalleCompraData?.id_producto,
      proveedor: item.detalleCompraData?.id_proveedor,
      lote: item.detalleCompraData?.numero_lote || "",
      cantidad: toNumber(item.detalleCompraData?.cantidad),
      subCantidad: toNumber(item.detalleCompraData?.subCantidad),
      precio: toNumber(item.detalleCompraData?.precio_unitario),
      caducidad: item.detalleCompraData?.fecha_caducidad || "",
    }))
  );

class servicesProducto {
  constructor() {
    this.sesion = {};
  }

  async getAllProducts(filters = {}) {
    try {
      if (filters?.simple) {
        return await this.getProductsSimple(filters);
      }

      const idSucursal = Number(filters?.id_sucursal);
      const inventarioWhere =
        Number.isFinite(idSucursal) && idSucursal > 0
          ? { id_sucursal: idSucursal }
          : {};
      const products = await Producto.findAll({
        where: {
          activo: {
            [Op.ne]: false,
          },
        },
        include: [
          ...(Number.isFinite(idSucursal) && idSucursal > 0
            ? []
            : [{ model: Lote, as: "lotes" }]),
          {
            model: Inventario,
            as: "inventarios",
            where: inventarioWhere,
            required: Number.isFinite(idSucursal) && idSucursal > 0,
            attributes: [
              "id_inventario",
              "id_producto",
              "id_lote",
              "cantidad",
              "subCantidad",
              "peso",
              "id_sucursal",
            ],
          },
        ],
        order: [["id_producto", "DESC"]],
      });
      return products.map((product) => {
        const plainProduct = product.toJSON();
        const inventarios = plainProduct.inventarios || [];

        plainProduct.stock = inventarios.reduce(
          (total, inventario) => total + toNumber(inventario.cantidad),
          0
        );
        plainProduct.subCantidad = inventarios.reduce(
          (total, inventario) => total + toNumber(inventario.subCantidad),
          0
        );
        plainProduct.peso = inventarios.reduce(
          (total, inventario) => total + toNumber(inventario.peso),
          0
        );

        return plainProduct;
      });
    } catch (error) {
      console.error("Error fetching all products:", error);
      throw error;
    }
  }

  async getProductsSimple(filters = {}) {
    const busqueda = String(filters?.q || "").trim();
    const limit = Math.min(Math.max(Number(filters?.limit) || 100, 1), 3000);
    const replacements = { limit };
    const filtrosBusqueda = [];

    if (busqueda) {
      replacements.busqueda = `%${busqueda.toLowerCase()}%`;
      filtrosBusqueda.push(`
        AND (
          LOWER(p."nombre") LIKE :busqueda
          OR LOWER(COALESCE(p."codigo_barra", '')) LIKE :busqueda
          OR LOWER(COALESCE(p."concentracion", '')) LIKE :busqueda
          OR LOWER(COALESCE(p."forma_farmaceutica", '')) LIKE :busqueda
        )
      `);
    }

    const products = await sequelize.query(
      `
        SELECT
          p."id_producto",
          p."nombre",
          p."codigo_barra",
          p."precio",
          p."concentracion",
          p."forma_farmaceutica",
          ultimo."fecha_caducidad" AS "ultima_fecha_caducidad",
          ultimo."precioVenta" AS "ultimo_precio_venta",
          ultimo."precio_unitario" AS "ultimo_precio_compra",
          ultimo."id_proveedor" AS "ultimo_id_proveedor",
          ultimo."proveedor_nombre" AS "ultimo_proveedor_nombre"
        FROM "Producto" p
        LEFT JOIN LATERAL (
          SELECT
            l."fecha_caducidad",
            l."precioVenta",
            dc."precio_unitario",
            dc."id_proveedor",
            pr."nombre" AS "proveedor_nombre"
          FROM "Lote" l
          LEFT JOIN "DetalleCompra" dc ON dc."id_detalle" = l."id_detalle_compra"
          LEFT JOIN "Proveedor" pr ON pr."id_proveedor" = dc."id_proveedor"
          WHERE l."id_producto" = p."id_producto"
          ORDER BY l."fecha_ingreso" DESC NULLS LAST, l."id_lote" DESC
          LIMIT 1
        ) ultimo ON true
        WHERE COALESCE(p."activo", true) <> false
          ${filtrosBusqueda.join("\n")}
        ORDER BY p."nombre" ASC
        LIMIT :limit
      `,
      {
        type: QueryTypes.SELECT,
        replacements,
      }
    );

    return products;
  }

  async getProductById(id) {
    try {
      const product = await Producto.findOne({
        where: {
          id_producto: id,
          activo: {
            [Op.ne]: false,
          },
        },
      });
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
            fecha_movimiento: getNowLapaz(),
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
          fecha_actualizacion: getNowLapaz(),
          id_trabajador: data.id_trabajador,
          id_sucursal: data.id_sucursal,
        },
        transaction
      );

      await ajustesService.sincronizarStockProducto(id, transaction);

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
      await product.update({ activo: false });
      return { message: "Producto dado de baja correctamente" };
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  async getInventariosByProductId(id, idSucursal = null) {
    try {
      const product = await Producto.findOne({
        where: {
          id_producto: id,
          activo: {
            [Op.ne]: false,
          },
        },
        include: [
          {
            model: Inventario,
            as: "inventarios",
            where:
              Number(idSucursal) > 0
                ? { id_sucursal: Number(idSucursal) }
                : undefined,
            required: Number(idSucursal) > 0,
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

  async createDetalleCompraYLoteAndUpdateProduct(payload) {
    const arrayData = Array.isArray(payload) ? payload : payload.items || [];
    const requestId = Array.isArray(payload) ? null : payload.requestId;
    const compraKey = buildCompraKey(arrayData);

    if (!arrayData.length) {
      throw new Error("No hay productos para registrar la compra");
    }

    if (comprasEnProceso.has(compraKey)) {
      throw new Error("Esta compra ya se está procesando. Espere un momento.");
    }

    if (comprasProcesadas.has(compraKey)) {
      return comprasProcesadas.get(compraKey);
    }

    comprasEnProceso.add(compraKey);

    console.log("Array original recibido:", { requestId, items: arrayData });

    const seen = new Set();
    const filteredArrayData = arrayData.filter((item) => {
      const key = `${item.detalleCompraData.id_producto}-${item.detalleCompraData.numero_lote}`;
      if (seen.has(key)) {
        console.log("❌ Duplicado encontrado y eliminado:", key);
        return false;
      }
      seen.add(key);
      return true;
    });

    console.log("Array filtrado sin duplicados:", filteredArrayData);

    // Una compra con cantidad negativa no tiene sentido (es una entrada de
    // stock, no una salida) y dejaba lotes en negativo desde el momento en
    // que se creaban, sin pasar por ninguna venta ni movimiento. Se
    // rechaza aqui, antes de tocar la base de datos.
    for (const item of filteredArrayData) {
      const cantidad = Number(item.detalleCompraData?.cantidad);
      const subCantidad = Number(item.detalleCompraData?.subCantidad);
      const nombreProducto = item.detalleCompraData?.nombre || `producto #${item.detalleCompraData?.id_producto}`;
      if ((Number.isFinite(cantidad) && cantidad < 0) || (Number.isFinite(subCantidad) && subCantidad < 0)) {
        throw new Error(
          `La cantidad de "${nombreProducto}" no puede ser negativa (cantidad=${item.detalleCompraData?.cantidad}, subCantidad=${item.detalleCompraData?.subCantidad}).`
        );
      }
    }

    const transaction = await sequelize.transaction();

    // Si no se indica un numero de factura, se genera uno automatico
    // compartido por todos los items de esta misma compra (para que se
    // puedan agrupar como una sola factura en el reporte).
    const numeroFacturaAuto = `SN-${Date.now()}`;

    try {
      const results = [];

      for (const item of filteredArrayData) {
        // El numero de lote puede repetirse a proposito: un mismo codigo de
        // lote del proveedor puede volver a aparecer en una compra distinta
        // (otro envio/reposicion), y cada compra debe registrar su propio
        // Lote (con su propia cantidad, fecha de ingreso y DetalleCompra),
        // no reutilizar ni rechazar el anterior.

        // La hora de registro la pone el servidor, no el navegador de quien
        // registra la compra (la fecha de caducidad si es la que elige el usuario).
        const numeroFactura =
          String(item.detalleCompraData?.numero_factura || "").trim() ||
          numeroFacturaAuto;
        const newDetalleCompra = await DetalleCompra.create(
          {
            ...item.detalleCompraData,
            fecha_compra: getNowLapaz(),
            numero_factura: numeroFactura,
            id_proveedor_factura:
              item.detalleCompraData?.id_proveedor_factura || null,
          },
          {
            transaction,
          }
        );
        const id_detalle_compra = newDetalleCompra.id_detalle;

        const loteData = {
          ...item.loteData,
          id_detalle_compra,
          fecha_ingreso: getNowLapaz(),
          fecha_compra: getNowLapaz(),
        };
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
              fecha_movimiento: getNowLapaz(),
              id_trabajador: item.productUpdateData.id_trabajador,
              lote: newLote.id_lote,
              id_sucursal: item.productUpdateData.id_sucursal,
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
            fecha_actualizacion: getNowLapaz(),
            id_trabajador: item.productUpdateData.id_trabajador,
            id_sucursal: item.productUpdateData.id_sucursal,
          },
          transaction
        );

        await ajustesService.sincronizarStockProducto(
          item.productId,
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
      comprasProcesadas.set(compraKey, results);
      setTimeout(() => comprasProcesadas.delete(compraKey), 1000 * 60 * 10);
      return results;
    } catch (error) {
      await transaction.rollback();
      console.error("Error creando registros y actualizando producto:", error);
      throw error;
    } finally {
      comprasEnProceso.delete(compraKey);
    }
  }
}

module.exports = servicesProducto;
