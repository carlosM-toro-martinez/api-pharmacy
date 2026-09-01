const {
  Producto,
  Lote,
  MetodoVenta,
  Proveedor,
  DetalleCompra,
  Sucursal,
} = require("../models");
const { Op, QueryTypes } = require("sequelize");
const Inventario = require("../models/Inventario");
const sequelize = require("../libs/dbConexionORM");

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

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

class servicesInventario {
  constructor() {
    this.sesion = {};
  }

  async getAllProductosConInventarios(filters = {}) {
    try {
      const idSucursal = Number(filters?.id_sucursal);
      const modoTransferencia = filters?.transferencia === true;
      const busqueda = String(filters?.q || "").trim();
      const limit = Math.min(
        Math.max(Number(filters?.limit) || 80, 1),
        250
      );
      const inventarioWhere = Number.isFinite(idSucursal) && idSucursal > 0
        ? { id_sucursal: idSucursal }
        : {};

      if (modoTransferencia) {
        if (!Number.isFinite(idSucursal) || idSucursal <= 0) {
          return [];
        }

        const replacements = {
          idSucursal,
          limit,
        };
        const filtrosBusqueda = [];

        if (busqueda) {
          replacements.busqueda = `%${busqueda.toLowerCase()}%`;
          filtrosBusqueda.push(`
            AND (
              LOWER(p."nombre") LIKE :busqueda
              OR LOWER(COALESCE(p."codigo_barra", '')) LIKE :busqueda
            )
          `);
        }

        const productos = await sequelize.query(
          `
            SELECT
              p."id_producto",
              p."nombre",
              p."codigo_barra",
              p."concentracion",
              p."forma_farmaceutica",
              agg."subCantidad",
              ultimo."fecha_caducidad" AS "ultima_fecha_caducidad",
              ultimo."precioVenta" AS "ultimo_precio_venta",
              ultimo."precio_unitario" AS "ultimo_precio_compra",
              ultimo."id_proveedor" AS "ultimo_id_proveedor",
              ultimo."proveedor_nombre" AS "ultimo_proveedor_nombre"
            FROM (
              SELECT
                i."id_producto",
                SUM(
                  CASE WHEN COALESCE(i."subCantidad", 0) > 0
                    THEN COALESCE(i."subCantidad", 0)
                    ELSE COALESCE(i."cantidad", 0)
                  END
                )::int AS "subCantidad"
              FROM "Inventario" i
              WHERE i."id_sucursal" = :idSucursal
                AND (COALESCE(i."subCantidad", 0) > 0 OR COALESCE(i."cantidad", 0) > 0)
              GROUP BY i."id_producto"
            ) agg
            INNER JOIN "Producto" p
              ON p."id_producto" = agg."id_producto"
            LEFT JOIN LATERAL (
              SELECT
                l."fecha_caducidad",
                l."precioVenta",
                dc."precio_unitario",
                dc."id_proveedor",
                pr."nombre" AS "proveedor_nombre"
              FROM "Inventario" i2
              INNER JOIN "Lote" l ON l."id_lote" = i2."id_lote"
              LEFT JOIN "DetalleCompra" dc ON dc."id_detalle" = l."id_detalle_compra"
              LEFT JOIN "Proveedor" pr ON pr."id_proveedor" = dc."id_proveedor"
              WHERE i2."id_producto" = p."id_producto"
                AND i2."id_sucursal" = :idSucursal
                AND (COALESCE(i2."subCantidad", 0) > 0 OR COALESCE(i2."cantidad", 0) > 0)
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

        return productos.map((producto) => ({
          ...producto,
          subCantidad: toNumber(producto.subCantidad),
        }));
      }

      const productos = await Producto.findAll({
        where: {
          activo: {
            [Op.ne]: false,
          },
        },
        include: [
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
              "fecha_actualizacion",
              "id_trabajador",
              "id_sucursal",
            ],
            include: [
              {
                model: Lote,
                as: "lote",
                attributes: [
                  "id_lote",
                  "numero_lote",
                  "fecha_ingreso",
                  "fecha_caducidad",
                  "cantidad",
                  "subCantidad",
                  "peso",
                  "cantidadPorCaja",
                  "precioVenta",
                ],
                include: [
                  {
                    model: Producto,
                    as: "producto",
                    attributes: ["precio"],
                    include: [
                      {
                        model: MetodoVenta,
                        as: "metodosVenta",
                        attributes: [
                          "id_metodo_venta",
                          "descripcion",
                          "cantidad_por_metodo",
                          "peso_por_metodo",
                          "precio",
                        ],
                      },
                    ],
                  },
                  {
                    model: DetalleCompra,
                    as: "detalleCompra",
                    attributes: ["id_detalle", "id_proveedor"],
                    include: {
                      model: Proveedor,
                      as: "proveedor",
                    },
                  },
                ],
              },
            ],
          },
        ],
        order: [["id_producto", "ASC"]],
      });

      return productos.map((producto) => {
        const plainProduct = producto.toJSON();
        const inventarios = plainProduct.inventarios || [];
        const totalesInventario = inventarios.reduce(
          (totales, inventario) => ({
            stock: totales.stock + toNumber(inventario.cantidad),
            subCantidad:
              totales.subCantidad + toNumber(inventario.subCantidad),
            peso: totales.peso + toNumber(inventario.peso),
          }),
          { stock: 0, subCantidad: 0, peso: 0 }
        );

        return {
          ...plainProduct,
          stock: totalesInventario.stock,
          subCantidad: totalesInventario.subCantidad,
          peso: totalesInventario.peso,
          totalCantidad: totalesInventario.stock,
          totalSubCantidad: totalesInventario.subCantidad,
          totalPeso: totalesInventario.peso,
        };
      });
    } catch (error) {
      console.error(
        "Error fetching productos with inventarios and lotes:",
        error
      );
      throw error;
    }
  }

  // Busca un producto por nombre/codigo y muestra en que sucursales hay stock.
  async buscarStockPorSucursales(filters = {}) {
    try {
      const busqueda = String(filters?.q || "").trim();
      if (!busqueda) return [];

      const idSucursalExcluir = Number(filters?.excluir_sucursal);
      const limit = Math.min(Math.max(Number(filters?.limit) || 40, 1), 150);

      const replacements = {
        busqueda: `%${busqueda.toLowerCase()}%`,
        limit,
      };
      let filtroExcluir = "";
      if (Number.isFinite(idSucursalExcluir) && idSucursalExcluir > 0) {
        filtroExcluir = `AND i."id_sucursal" <> :idSucursalExcluir`;
        replacements.idSucursalExcluir = idSucursalExcluir;
      }

      const filas = await sequelize.query(
        `
          SELECT
            p."id_producto",
            p."nombre",
            p."codigo_barra",
            p."concentracion",
            p."forma_farmaceutica",
            i."id_sucursal",
            s."nombre" AS "sucursalNombre",
            SUM(
              CASE WHEN COALESCE(i."subCantidad", 0) > 0
                THEN COALESCE(i."subCantidad", 0)
                ELSE COALESCE(i."cantidad", 0)
              END
            )::int AS "subCantidad"
          FROM "Inventario" i
          INNER JOIN "Producto" p ON p."id_producto" = i."id_producto"
          INNER JOIN "Sucursal" s ON s."id_sucursal" = i."id_sucursal"
          WHERE (COALESCE(i."subCantidad", 0) > 0 OR COALESCE(i."cantidad", 0) > 0)
            AND COALESCE(p."activo", true) <> false
            AND COALESCE(s."activo", true) <> false
            AND (
              LOWER(p."nombre") LIKE :busqueda
              OR LOWER(COALESCE(p."codigo_barra", '')) LIKE :busqueda
            )
            ${filtroExcluir}
          GROUP BY
            p."id_producto", p."nombre", p."codigo_barra",
            p."concentracion", p."forma_farmaceutica",
            i."id_sucursal", s."nombre"
          ORDER BY p."nombre" ASC, s."nombre" ASC
          LIMIT :limit
        `,
        { type: QueryTypes.SELECT, replacements }
      );

      const productosPorId = new Map();
      for (const fila of filas) {
        if (!productosPorId.has(fila.id_producto)) {
          productosPorId.set(fila.id_producto, {
            id_producto: fila.id_producto,
            nombre: fila.nombre,
            codigo_barra: fila.codigo_barra,
            concentracion: fila.concentracion,
            forma_farmaceutica: fila.forma_farmaceutica,
            sucursales: [],
          });
        }
        productosPorId.get(fila.id_producto).sucursales.push({
          id_sucursal: fila.id_sucursal,
          nombre: fila.sucursalNombre,
          subCantidad: toNumber(fila.subCantidad),
        });
      }

      return Array.from(productosPorId.values());
    } catch (error) {
      console.error("Error buscando stock por sucursales:", error);
      throw error;
    }
  }

  async getInventario(id_inventario) {
    try {
      const inventario = await Inventario.findByPk(id_inventario);
      if (!inventario) {
        throw new Error(`Inventario with ID ${id_inventario} not found`);
      }
      return inventario;
    } catch (error) {
      console.error("Error fetching inventario:", error);
      throw error;
    }
  }

  async createInventario(data, transaction = null) {
    try {
      const idSucursal =
        data?.id_sucursal || (await obtenerIdSucursalPrincipal(transaction));
      const newInventario = await Inventario.create(
        { ...data, id_sucursal: idSucursal },
        { transaction }
      );
      return newInventario;
    } catch (error) {
      console.error("Error creating inventario:", error);
      throw error;
    }
  }

  async updateInventario(id_inventario, data) {
    try {
      const inventario = await Inventario.findByPk(id_inventario);
      if (!inventario) {
        throw new Error(`Inventario with ID ${id_inventario} not found`);
      }
      await inventario.update(data);
      return inventario;
    } catch (error) {
      console.error("Error updating inventario:", error);
      throw error;
    }
  }

  async deleteInventario(id_inventario) {
    try {
      const inventario = await Inventario.findByPk(id_inventario);
      if (!inventario) {
        throw new Error(`Inventario with ID ${id_inventario} not found`);
      }
      await inventario.destroy();
      return { message: "Inventario deleted successfully" };
    } catch (error) {
      console.error("Error deleting inventario:", error);
      throw error;
    }
  }
}

module.exports = servicesInventario;
