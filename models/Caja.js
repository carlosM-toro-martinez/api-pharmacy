const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Trabajador = require("./Trabajador");
const Sucursal = require("./Sucursal");

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
    modelName: "Caja",
    tableName: "Caja",
    timestamps: false,
    indexes: [
      { fields: ["fecha_apertura"] },
      { fields: ["id_sucursal"] },
    ],
  }
);

module.exports = Caja;
