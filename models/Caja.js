const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Trabajador = require("./Trabajador");

class Caja extends Model {}

Caja.init(
  {
    id_caja: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    monto_inicial: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    monto_final: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    fecha_apertura: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_cierre: {
      type: DataTypes.DATE,
    },
    id_trabajador: {
      type: DataTypes.INTEGER,
      references: {
        model: Trabajador,
        key: "id_trabajador",
      },
    },
  },
  {
    sequelize,
    modelName: "Caja",
    tableName: "Caja",
    timestamps: false,
  }
);

module.exports = Caja;
