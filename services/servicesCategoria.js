const Categoria = require("../models/Categoria");
const Producto = require("../models/Producto");

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
          attributes: ["nombre", "codigo_barra", "precio", "stock", "peso"],
        },
      });
      return categorias;
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
          attributes: ["nombre", "codigo_barra", "precio", "stock"],
        },
      });
      if (!categoria) {
        throw new Error(`Categoria with ID ${id_categoria} not found`);
      }
      return categoria;
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
