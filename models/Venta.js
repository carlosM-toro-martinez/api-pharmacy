const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Cliente = require("./Cliente");
const Trabajador = require("./Trabajador");
const Sucursal = require("./Sucursal");

class Venta extends Model {}

Venta.init(
  {
    id_venta: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fecha_venta: {
      type: DataTypes.DATE,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      references: {
        model: Cliente,
        key: "id_cliente",
      },
    },
    id_trabajador: {
      type: DataTypes.INTEGER,
      references: {
        model: Trabajador,
        key: "id_trabajador",
      },
    },
    rebaja_aplicada: {
      type: DataTypes.DECIMAL(5, 2),
    },
    descuento_fidelidad_aplicado: {
      type: DataTypes.DECIMAL(5, 2),
    },
    metodo_pago: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Contado",
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
    modelName: "Venta",
    tableName: "Venta",
    timestamps: false,
    indexes: [
      { fields: ["fecha_venta"] },
      { fields: ["id_sucursal"] },
    ],
  }
);

module.exports = Venta;
