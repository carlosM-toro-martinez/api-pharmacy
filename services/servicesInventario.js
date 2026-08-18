const {
  Producto,
  Lote,
  MetodoVenta,
  Proveedor,
  DetalleCompra,
  Sucursal,
} = require("../models");
const { Op } = require("sequelize");
const Inventario = require("../models/Inventario");

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const obtenerIdSucursalPrincipal = async (transaction = null) => {
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
      const inventarioWhere = Number.isFinite(idSucursal) && idSucursal > 0
        ? { id_sucursal: idSucursal }
        : {};

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
              "cantidad",
              "subCantidad",
              "peso",
              "fecha_actualizacion",
              "id_trabajador",
              "id_sucursal",
            ],
            include: [
              {
                model: Sucursal,
                as: "sucursal",
                attributes: ["id_sucursal", "nombre", "es_principal"],
              },
              {
                model: Lote,
                as: "lote",
                attributes: [
                  "id_lote",
                  "numero_lote",
                  "fecha_ingreso",
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
                    attributes: [
                      "nombre",
                      "codigo_barra",
                      "precio",
                      "stock",
                      "peso",
                      "subCantidad",
                    ],
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
