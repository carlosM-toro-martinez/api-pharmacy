const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class MetodoVenta extends Model {}

MetodoVenta.init(
  {
    id_metodo_venta: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cantidad_por_metodo: {
      type: DataTypes.INTEGER,
    },
    peso_por_metodo: {
      type: DataTypes.DECIMAL(10, 2),
    },
    precio: DataTypes.DECIMAL(10, 2),
    id_producto: {
      type: DataTypes.INTEGER,
      references: {
        model: "Producto",
        key: "id_producto",
      },
      onDelete: "CASCADE",
    },
  },
  {
    sequelize,
    modelName: "MetodoVenta",
    tableName: "MetodoVenta",
    timestamps: false,
  }
);

module.exports = MetodoVenta;
