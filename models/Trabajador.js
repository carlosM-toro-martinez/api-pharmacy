const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Rol = require("./Rol");
const Sucursal = require("./Sucursal");

class Trabajador extends Model {}

Trabajador.init(
  {
    id_trabajador: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(255),
    },
    apellido_paterno: {
      type: DataTypes.STRING(255),
    },
    apellido_materno: {
      type: DataTypes.STRING(255),
    },
    cargo: {
      type: DataTypes.STRING(255),
    },
    fecha_contratacion: {
      type: DataTypes.DATE,
    },
    id_rol: {
      type: DataTypes.INTEGER,
      references: {
        model: Rol,
        key: "id_rol",
      },
    },
    username: {
      type: DataTypes.STRING(255),
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    id_sucursal: {
      type: DataTypes.INTEGER,
      references: {
        model: Sucursal,
        key: "id_sucursal",
      },
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Trabajador",
    tableName: "Trabajador",
    timestamps: false,
  }
);

module.exports = Trabajador;
