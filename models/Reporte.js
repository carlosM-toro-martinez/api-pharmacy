const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");
const Trabajador = require("./Trabajador");

class Reporte extends Model {}

Reporte.init(
  {
    id_reporte: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tipo_reporte: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fecha_generacion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    contenido: {
      type: DataTypes.TEXT,
      allowNull: false,
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
    modelName: "Reporte",
    tableName: "Reporte",
    timestamps: false,
  }
);

module.exports = Reporte;
