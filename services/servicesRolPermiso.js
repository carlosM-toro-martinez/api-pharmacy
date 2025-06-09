const RolPermiso = require("../models/RolPermiso");

class servicesRolPermiso {
  constructor() {
    this.sesion = {};
  }

  // Método GET para obtener todas las relaciones Rol-Permiso
  async getAllRolPermisos() {
    try {
      const rolPermisos = await RolPermiso.findAll();
      return rolPermisos;
    } catch (error) {
      console.error("Error fetching all rol-permiso relations:", error);
      throw error;
    }
  }

  // Método GET para obtener una relación Rol-Permiso por id_rol e id_permiso
  async getRolPermiso(id_rol, id_permiso) {
    try {
      const rolPermiso = await RolPermiso.findOne({
        where: { id_rol, id_permiso },
      });
      if (!rolPermiso) {
        throw new Error(
          `Relation RolPermiso with Rol ID ${id_rol} and Permiso ID ${id_permiso} not found`
        );
      }
      return rolPermiso;
    } catch (error) {
      console.error("Error fetching rol-permiso relation:", error);
      throw error;
    }
  }

  // Método POST para crear una nueva relación Rol-Permiso
  async createRolPermiso(data) {
    try {
      const newRolPermiso = await RolPermiso.create(data);
      return newRolPermiso;
    } catch (error) {
      console.error("Error creating rol-permiso relation:", error);
      throw error;
    }
  }

  // Método DELETE para eliminar una relación Rol-Permiso por id_rol e id_permiso
  async deleteRolPermiso(id_rol, id_permiso) {
    try {
      const rolPermiso = await RolPermiso.findOne({
        where: { id_rol, id_permiso },
      });
      if (!rolPermiso) {
        throw new Error(
          `Relation RolPermiso with Rol ID ${id_rol} and Permiso ID ${id_permiso} not found`
        );
      }
      await rolPermiso.destroy();
      return { message: "Relation RolPermiso deleted successfully" };
    } catch (error) {
      console.error("Error deleting rol-permiso relation:", error);
      throw error;
    }
  }
}

module.exports = servicesRolPermiso;
