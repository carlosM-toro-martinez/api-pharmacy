const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Producto = require("./Producto");
const DetalleCompra = require("./DetalleCompra");

class Lote extends Model {}

Lote.init(
  {
    id_lote: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_producto: {
      type: DataTypes.INTEGER,
      references: {
        model: Producto,
        key: "id_producto",
      },
    },
    numero_lote: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fecha_ingreso: {
      type: DataTypes.DATE,
    },
    fecha_caducidad: {
      type: DataTypes.DATE,
    },
    cantidad: {
      type: DataTypes.INTEGER,
    },

    cantidadPorCaja: {
      type: DataTypes.INTEGER,
    },
    precioVenta: {
      type: DataTypes.DECIMAL(10, 2),
    },
    subCantidad: DataTypes.INTEGER,
    peso: DataTypes.DECIMAL(10, 2),
    id_detalle_compra: {
      type: DataTypes.INTEGER,
      references: {
        model: DetalleCompra,
        key: "id_detalle",
      },
    },
  },
  {
    sequelize,
    modelName: "Lote",
    tableName: "Lote",
    timestamps: false,
    unique: ["id_producto", "numero_lote"],
  }
);

module.exports = Lote;
