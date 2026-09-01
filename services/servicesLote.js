const Lote = require("../models/Lote");
const { QueryTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class servicesLote {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los lotes

  // Version liviana: solo lo que se usa hoy (revisar numero_lote existente
  // al registrar una compra). Antes traia el inventario completo de cada
  // producto por cada lote, lo que la hacia muy lenta (miles de filas).
  async getAllLotes() {
    try {
      return await Lote.findAll({
        attributes: ["id_lote", "id_producto", "numero_lote"],
        raw: true,
      });
    } catch (error) {
      console.error("Error fetching all lotes:", error);
      throw error;
    }
  }

  // Método GET para obtener los lotes próximos a vencer, por sucursal

  async getTop20LotesPorVencer(filters = {}) {
    try {
      const idSucursal = Number(filters?.id_sucursal);
      const dias = Math.min(Math.max(Number(filters?.dias) || 90, 1), 3650);
      const limit = Math.min(Math.max(Number(filters?.limit) || 20, 1), 100);

      const replacements = { dias, limit };
      let filtroSucursal = "";
      if (Number.isFinite(idSucursal) && idSucursal > 0) {
        filtroSucursal = `AND i."id_sucursal" = :idSucursal`;
        replacements.idSucursal = idSucursal;
      }

      const lotes = await sequelize.query(
        `
          SELECT
            l."id_lote",
            l."numero_lote",
            l."fecha_caducidad",
            p."id_producto",
            p."nombre",
            p."codigo_barra",
            i."id_sucursal",
            GREATEST(COALESCE(i."cantidad", 0), COALESCE(i."subCantidad", 0))::int AS "unidades"
          FROM "Lote" l
          INNER JOIN "Inventario" i ON i."id_lote" = l."id_lote"
          INNER JOIN "Producto" p ON p."id_producto" = l."id_producto"
          WHERE l."fecha_caducidad" IS NOT NULL
            AND l."fecha_caducidad" <= (CURRENT_DATE + (:dias || ' days')::interval)
            AND GREATEST(COALESCE(i."cantidad", 0), COALESCE(i."subCantidad", 0)) > 0
            AND COALESCE(p."activo", true) <> false
            ${filtroSucursal}
          ORDER BY l."fecha_caducidad" ASC
          LIMIT :limit
        `,
        { type: QueryTypes.SELECT, replacements }
      );

      return lotes;
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
