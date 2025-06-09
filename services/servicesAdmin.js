const Administrador = require("../models/Administrador");

class servicesAdmin {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todos los administradores
  async getAllAdmins() {
    try {
      const admins = await Administrador.findAll();
      return admins;
    } catch (error) {
      console.error("Error fetching all admins:", error);
      throw error;
    }
  }

  // Método GET para obtener un administrador por ID
  async getAdminById(id) {
    try {
      const admin = await Administrador.findByPk(id);
      if (!admin) {
        throw new Error(`Admin with ID ${id} not found`);
      }
      return admin;
    } catch (error) {
      console.error("Error fetching admin by ID:", error);
      throw error;
    }
  }

  // Método POST para crear un nuevo administrador
  async createAdmin(data) {
    try {
      const newAdmin = await Administrador.create(data);
      return newAdmin;
    } catch (error) {
      console.error("Error creating admin:", error);
      throw error;
    }
  }

  // Método PUT para actualizar un administrador por ID
  async updateAdmin(id, data) {
    try {
      const admin = await Administrador.findByPk(id);
      if (!admin) {
        throw new Error(`Admin with ID ${id} not found`);
      }
      await admin.update(data);
      return admin;
    } catch (error) {
      console.error("Error updating admin:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar un administrador por ID
  async deleteAdmin(id) {
    try {
      const admin = await Administrador.findByPk(id);
      if (!admin) {
        throw new Error(`Admin with ID ${id} not found`);
      }
      await admin.destroy();
      return { message: "Admin deleted successfully" };
    } catch (error) {
      console.error("Error deleting admin:", error);
      throw error;
    }
  }
}

module.exports = servicesAdmin;
