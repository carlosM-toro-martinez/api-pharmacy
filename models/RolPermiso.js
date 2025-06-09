const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Rol = require("./Rol");
const Permiso = require("./Permiso");

class RolPermiso extends Model {}

RolPermiso.init(
  {
    id_rol: {
      type: DataTypes.INTEGER,
      references: {
        model: Rol,
        key: "id_rol",
      },
    },
    id_permiso: {
      type: DataTypes.INTEGER,
      references: {
        model: Permiso,
        key: "id_permiso",
      },
    },
  },
  {
    sequelize,
    modelName: "RolPermiso",
    tableName: "RolPermiso",
    timestamps: false,
    primaryKey: true,
  }
);

module.exports = RolPermiso;
