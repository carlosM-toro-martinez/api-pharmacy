const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Proveedor = require("./Proveedor");
const Producto = require("./Producto");
const Trabajador = require("./Trabajador");

class DetalleCompra extends Model {}

DetalleCompra.init(
  {
    id_detalle: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_proveedor: {
      type: DataTypes.INTEGER,
      references: {
        model: Proveedor,
        key: "id_proveedor",
      },
    },
    id_producto: {
      type: DataTypes.INTEGER,
      references: {
        model: Producto,
        key: "id_producto",
      },
    },
    cantidad: {
      type: DataTypes.INTEGER,
    },

    subCantidad: DataTypes.INTEGER,
    precio_unitario: {
      type: DataTypes.DECIMAL(10, 2),
    },
    peso: DataTypes.DECIMAL(10, 2),
    fecha_compra: {
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
    modelName: "DetalleCompra",
    tableName: "DetalleCompra",
    timestamps: false,
  }
);

module.exports = DetalleCompra;
