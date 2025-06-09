const sequelize = require("../libs/dbConexionORM");
const Trabajador = require("../models/Trabajador");
const Rol = require("../models/Rol");
const RolPermiso = require("../models/RolPermiso");
const Permiso = require("../models/Permiso");
const bcrypt = require("bcryptjs");

class servicesTrabajador {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los trabajadores
  async getAllTrabajadores() {
    try {
      const trabajadores = await Trabajador.findAll({
        include: {
          model: Rol,
          as: "rol",
          attributes: ["id_rol", "nombre"],
        },
      });
      return trabajadores;
    } catch (error) {
      console.error("Error fetching all trabajadores:", error);
      throw error;
    }
  }

  // Método GET para obtener un trabajador por id_trabajador
  async getTrabajador(id_trabajador) {
    try {
      const trabajador = await Trabajador.findByPk(id_trabajador);
      if (!trabajador) {
        throw new Error(`Trabajador with ID ${id_trabajador} not found`);
      }
      return trabajador;
    } catch (error) {
      console.error("Error fetching trabajador:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo trabajador

  async createTrabajador(data) {
    try {
      const {
        nombre,
        apellido_paterno,
        apellido_materno,
        cargo,
        fecha_contratacion,
        username,
        password,
        id_rol,
      } = data;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newTrabajador = await Trabajador.create({
        nombre,
        apellido_paterno,
        apellido_materno,
        cargo,
        fecha_contratacion,
        id_rol,
        username,
        password: hashedPassword,
      });

      return newTrabajador;
    } catch (error) {
      console.error("Error creating trabajador:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un trabajador por id_trabajador
  async updateTrabajador(id_trabajador, data) {
    try {
      const trabajador = await Trabajador.findByPk(id_trabajador);
      if (!trabajador) {
        throw new Error(`Trabajador with ID ${id_trabajador} not found`);
      }
      await trabajador.update(data);
      return trabajador;
    } catch (error) {
      console.error("Error updating trabajador:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un trabajador por id_trabajador
  async deleteTrabajador(id_trabajador) {
    try {
      // 1. Buscamos el trabajador por PK
      const trabajador = await Trabajador.findByPk(id_trabajador);
      if (!trabajador) {
        throw new Error(`Trabajador with ID ${id_trabajador} not found`);
      }

      // 2. En lugar de eliminarlo, actualizamos solo el campo "estado"
      await trabajador.update({ estado: false });

      return {
        message: "Trabajador desactivado (estado = false) correctamente",
      };
    } catch (error) {
      console.error("Error desactivando trabajador:", error);
      throw error;
    }
  }
}

module.exports = servicesTrabajador;
