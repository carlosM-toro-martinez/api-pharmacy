const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Cliente = require("./Cliente");
const Venta = require("./Venta");

class Garantia extends Model {}

Garantia.init(
  {
    id_garantia: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      references: {
        model: Cliente,
        key: "id_cliente",
      },
      allowNull: false,
    },
    id_venta: {
      type: DataTypes.INTEGER,
      references: {
        model: Venta,
        key: "id_venta",
      },
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    estado: {
      type: DataTypes.ENUM("Activa", "Devuelta"),
      allowNull: false,
      defaultValue: "Activa",
    },
  },
  {
    sequelize,
    modelName: "Garantia",
    tableName: "Garantia",
    timestamps: false,
  }
);

module.exports = Garantia;
