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
    // id_proveedor ya existe y representa la linea/marca del producto
    // (ej. el laboratorio). Esto es distinto: la distribuidora que emitio
    // la factura de la compra y el numero de esa factura.
    id_proveedor_factura: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Proveedor,
        key: "id_proveedor",
      },
    },
    numero_factura: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "DetalleCompra",
    tableName: "DetalleCompra",
    timestamps: false,
    indexes: [
      { fields: ["id_producto"] },
      { fields: ["id_proveedor"] },
      { fields: ["fecha_compra"] },
      { fields: ["id_proveedor_factura"] },
      { fields: ["numero_factura"] },
    ],
  }
);

module.exports = DetalleCompra;
