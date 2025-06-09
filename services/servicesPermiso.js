const Permiso = require("../models/Permiso");

class servicesPermiso {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los permisos
  async getAllPermisos() {
    try {
      const permisos = await Permiso.findAll();
      return permisos;
    } catch (error) {
      console.error("Error fetching all permisos:", error);
      throw error;
    }
  }

  // Método GET para obtener un permiso por ID
  async getPermisoById(id) {
    try {
      const permiso = await Permiso.findByPk(id);
      if (!permiso) {
        throw new Error(`Permiso with ID ${id} not found`);
      }
      return permiso;
    } catch (error) {
      console.error("Error fetching permiso by ID:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo permiso
  async createPermiso(data) {
    try {
      const newPermiso = await Permiso.create(data);
      return newPermiso;
    } catch (error) {
      console.error("Error creating permiso:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un permiso por ID
  async updatePermiso(id, data) {
    try {
      const permiso = await Permiso.findByPk(id);
      if (!permiso) {
        throw new Error(`Permiso with ID ${id} not found`);
      }
      await permiso.update(data);
      return permiso;
    } catch (error) {
      console.error("Error updating permiso:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un permiso por ID
  async deletePermiso(id) {
    try {
      const permiso = await Permiso.findByPk(id);
      if (!permiso) {
        throw new Error(`Permiso with ID ${id} not found`);
      }
      await permiso.destroy();
      return { message: "Permiso deleted successfully" };
    } catch (error) {
      console.error("Error deleting permiso:", error);
      throw error;
    }
  }
}

module.exports = servicesPermiso;
