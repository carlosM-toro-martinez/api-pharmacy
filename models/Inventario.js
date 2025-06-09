const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Producto = require("./Producto");
const Lote = require("./Lote");
const Trabajador = require("./Trabajador");

class Inventario extends Model {}

Inventario.init(
  {
    id_inventario: {
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
    id_lote: {
      type: DataTypes.INTEGER,
      references: {
        model: Lote,
        key: "id_lote",
      },
    },
    cantidad: {
      type: DataTypes.INTEGER,
    },
    subCantidad: DataTypes.INTEGER,
    peso: DataTypes.DECIMAL(10, 2),
    fecha_actualizacion: {
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
    modelName: "Inventario",
    tableName: "Inventario",
    timestamps: false,
  }
);

module.exports = Inventario;
