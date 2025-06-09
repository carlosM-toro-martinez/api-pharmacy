const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Caja = require("./Caja");
const Trabajador = require("./Trabajador");

class MovimientoCaja extends Model {}

MovimientoCaja.init(
  {
    id_movimiento: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_caja: {
      type: DataTypes.INTEGER,
      references: {
        model: Caja,
        key: "id_caja",
      },
    },
    tipo_movimiento: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    fecha_movimiento: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    id_trabajador: {
      type: DataTypes.INTEGER,
      references: {
        model: Trabajador,
        key: "id_trabajador",
      },
    },
    motivo: {
      type: DataTypes.STRING(255),
    },
  },
  {
    sequelize,
    modelName: "MovimientoCaja",
    tableName: "MovimientoCaja",
    timestamps: false,
  }
);

module.exports = MovimientoCaja;
