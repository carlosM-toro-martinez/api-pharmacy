const Categoria = require("../models/Categoria");
const Producto = require("../models/Producto");
const Inventario = require("../models/Inventario");
const { Op } = require("sequelize");

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const categoriaConProductosActualizados = (categoria) => {
  const plainCategoria = categoria.toJSON();
  const productos = plainCategoria.productos || [];

  return {
    ...plainCategoria,
    productos: productos.map((producto) => {
      const inventarios = producto.inventarios || [];
      const stockInventario = inventarios.reduce(
        (totales, inventario) => ({
          stock: totales.stock + toNumber(inventario.cantidad),
          subCantidad: totales.subCantidad + toNumber(inventario.subCantidad),
          peso: totales.peso + toNumber(inventario.peso),
        }),
        { stock: 0, subCantidad: 0, peso: 0 }
      );

      return {
        ...producto,
        stock: stockInventario.stock,
        subCantidad: stockInventario.subCantidad,
        peso: stockInventario.peso,
        totalCantidad: stockInventario.stock,
        totalSubCantidad: stockInventario.subCantidad,
        totalPeso: stockInventario.peso,
      };
    }),
  };
};

class servicesCategoria {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todas las categorías
  async getAllCategorias() {
    try {
      const categorias = await Categoria.findAll({
        include: {
          model: Producto,
          as: "productos",
          where: {
            activo: {
              [Op.ne]: false,
            },
          },
          required: false,
          attributes: [
            "id_producto",
            "nombre",
            "codigo_barra",
            "precio",
            "stock",
            "subCantidad",
            "peso",
          ],
          include: {
            model: Inventario,
            as: "inventarios",
            attributes: ["cantidad", "subCantidad", "peso"],
          },
        },
      });
      return categorias.map(categoriaConProductosActualizados);
    } catch (error) {
      console.error("Error fetching all categorias:", error);
      throw error;
    }
  }

  // Método GET para obtener una categoría por id_categoria
  async getCategoria(id_categoria) {
    try {
      const categoria = await Categoria.findByPk(id_categoria, {
        include: {
          model: Producto,
          as: "productos",
          where: {
            activo: {
              [Op.ne]: false,
            },
          },
          required: false,
          attributes: [
            "id_producto",
            "nombre",
            "codigo_barra",
            "precio",
            "stock",
            "subCantidad",
            "peso",
          ],
          include: {
            model: Inventario,
            as: "inventarios",
            attributes: ["cantidad", "subCantidad", "peso"],
          },
        },
      });
      if (!categoria) {
        throw new Error(`Categoria with ID ${id_categoria} not found`);
      }
      return categoriaConProductosActualizados(categoria);
    } catch (error) {
      console.error("Error fetching categoria:", error);
      throw error;
    }
  }

  // Método POST para crear una nueva categoría
  async createCategoria(data) {
    try {
      const newCategoria = await Categoria.create(data);
      return newCategoria;
    } catch (error) {
      console.error("Error creating categoria:", error);
      throw error;
    }
  }

  // Método PUT para actualizar una categoría por id_categoria
  async updateCategoria(id_categoria, data) {
    try {
      const categoria = await Categoria.findByPk(id_categoria);
      if (!categoria) {
        throw new Error(`Categoria with ID ${id_categoria} not found`);
      }
      await categoria.update(data);
      return categoria;
    } catch (error) {
      console.error("Error updating categoria:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar una categoría por id_categoria
  async deleteCategoria(id_categoria) {
    try {
      const categoria = await Categoria.findByPk(id_categoria);
      if (!categoria) {
        throw new Error(`Categoria with ID ${id_categoria} not found`);
      }
      await categoria.destroy();
      return { message: "Categoria deleted successfully" };
    } catch (error) {
      console.error("Error deleting categoria:", error);
      throw error;
    }
  }
}

module.exports = servicesCategoria;
