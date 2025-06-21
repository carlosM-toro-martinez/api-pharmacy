const Lote = require("../models/Lote");
const Producto = require("../models/Producto");
const MetodoVenta = require("../models/MetodoVenta");
const Inventario = require("../models/Inventario");
const { Op } = require("sequelize");

class servicesLote {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los lotes

  async getAllLotes() {
    try {
      const lotes = await Lote.findAll({
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
            include: {
              model: MetodoVenta,
              as: "metodosVenta",
              attributes: [
                "id_metodo_venta",
                "descripcion",
                "cantidad_por_metodo",
                "precio",
              ],
            },
          },
        ],
      });
      return lotes;
    } catch (error) {
      console.error("Error fetching all lotes:", error);
      throw error;
    }
  }

  // Medodo Get para obtener los 20 proximos a vencer

  async getTop20LotesPorVencer() {
    try {
      // 1) Obtenemos TODOS los lotes ordenados
      const lotes = await Lote.findAll({
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
                model: Inventario,
                as: "inventarios",
                attributes: [
                  "id_inventario",
                  "id_producto",
                  "id_lote",
                  "cantidad",
                  "subCantidad",
                  "peso",
                  "fecha_actualizacion",
                  "id_trabajador",
                ],
              },
            ],
          },
        ],
        order: [["fecha_caducidad", "ASC"]],
      });

      // 2) Filtramos: por cada lote, buscamos el inventario que tenga el mismo id_lote
      const lotesConStock = lotes.filter((lote) => {
        // Buscamos en el array de inventarios del producto
        const inventarioDelLote = lote.producto.inventarios.find(
          (inv) => inv.id_lote === lote.id_lote
        );
        // Sólo mantenemos el lote si encontramos un inventario y su cantidad > 0
        return inventarioDelLote && inventarioDelLote.cantidad > 0;
      });

      // 3) Si efectivamente quieres devolver sólo los “top 20” que quedan tras filtrar:
      const top20 = lotesConStock.slice(0, 500);

      return top20;
    } catch (error) {
      console.error("Error al obtener los 20 lotes por vencer:", error);
      throw error;
    }
  }

  // Método GET para obtener un lote por id_lote
  async getLote(id_lote) {
    try {
      const lote = await Lote.findByPk(id_lote);
      if (!lote) {
        throw new Error(`Lote with ID ${id_lote} not found`);
      }
      return lote;
    } catch (error) {
      console.error("Error fetching lote:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo lote
  async createLote(data) {
    try {
      const newLote = await Lote.create(data);
      return newLote;
    } catch (error) {
      console.error("Error creating lote:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un lote por id_lote
  async updateLote(id_lote, data) {
    try {
      const lote = await Lote.findByPk(id_lote);
      if (!lote) {
        throw new Error(`Lote with ID ${id_lote} not found`);
      }
      await lote.update(data);
      return lote;
    } catch (error) {
      console.error("Error updating lote:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un lote por id_lote
  async deleteLote(id_lote) {
    try {
      const lote = await Lote.findByPk(id_lote);
      if (!lote) {
        throw new Error(`Lote with ID ${id_lote} not found`);
      }
      await lote.destroy();
      return { message: "Lote deleted successfully" };
    } catch (error) {
      console.error("Error deleting lote:", error);
      throw error;
    }
  }
}

module.exports = servicesLote;
