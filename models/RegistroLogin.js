const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class RegistroLogin extends Model {}

RegistroLogin.init(
  {
    id_registro: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tipo: {
      type: DataTypes.STRING(20),
    },
    accion: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "login",
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING(255),
    },
    nombre_completo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    exito: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    motivo_fallo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    id_sucursal: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "RegistroLogin",
    tableName: "RegistroLogin",
    timestamps: false,
    indexes: [{ fields: ["fecha"] }, { fields: ["username"] }],
  }
);

module.exports = RegistroLogin;
