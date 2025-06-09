const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Venta = require("./Venta");
const Producto = require("./Producto");
const Lote = require("./Lote");

class DetalleVenta extends Model {}

DetalleVenta.init(
  {
    id_detalle: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_venta: {
      type: DataTypes.INTEGER,
      references: {
        model: Venta,
        key: "id_venta",
      },
      onDelete: "CASCADE",
    },
    id_producto: {
      type: DataTypes.INTEGER,
      references: {
        model: Producto,
        key: "id_producto",
      },
    },
    id_lote: {
      type: DataTypes.INTEGER,
      references: {
        model: Lote,
        key: "id_lote",
      },
    },
    detalle: {
      type: DataTypes.STRING,
    },
    cantidad: {
      type: DataTypes.INTEGER,
    },
    subCantidad: DataTypes.INTEGER,
    peso: DataTypes.DECIMAL(10, 2),
    precio_unitario: {
      type: DataTypes.DECIMAL(10, 2),
    },
  },
  {
    sequelize,
    modelName: "DetalleVenta",
    tableName: "DetalleVenta",
    timestamps: false,
  }
);

module.exports = DetalleVenta;
