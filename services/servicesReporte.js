const express = require("express");
const { Op, Sequelize } = require("sequelize");
const {
  MovimientoInventario,
  Producto,
  Lote,
  DetalleCompra,
  MovimientoCaja,
  Trabajador,
  Venta,
  Proveedor,
  Cliente,
  DetalleVenta,
  Caja,
  Inventario,
} = require("../models");

class servicesReporte {
  constructor() {}

  async getLotesConDetalleCompra(idInicio, idFin) {
    try {
      const lotes = await Lote.findAll({
        where: {
          id_lote: {
            [Op.between]: [idInicio, idFin],
          },
        },
        include: [
          {
            model: DetalleCompra,
            as: "detalleCompra",
            include: [
              {
                model: Producto,
                as: "producto",
                attributes: ["id_producto", "nombre", "codigo_barra"],
              },
              {
                model: Proveedor,
                as: "proveedor",
                attributes: ["id_proveedor", "nombre"],
              },
            ],
          },
        ],
      });
      const lotesAgrupados = lotes.reduce((agrupados, lote) => {
        const { numero_lote } = lote;
        if (!agrupados[numero_lote]) {
          agrupados[numero_lote] = [];
        }
        agrupados[numero_lote].push(lote);
        return agrupados;
      }, {});

      const resultado = Object.keys(lotesAgrupados).map((numeroLote) => ({
        numero_lote: numeroLote,
        lotes: lotesAgrupados[numeroLote].map((lote) => ({
          id_lote: lote.id_lote,
          fecha_ingreso: lote.fecha_ingreso,
          fecha_caducidad: lote.fecha_caducidad,
          cantidad: lote.cantidad,
          subCantidad: lote.subCantidad,
          peso: lote.peso,
          cantidadPorCaja: lote.cantidadPorCaja,
          detalleCompra: {
            id_detalle: lote.detalleCompra.id_detalle,
            id_proveedor: lote.detalleCompra.id_proveedor,
            cantidad: lote.detalleCompra.cantidad,
            precio_unitario: lote.detalleCompra.precio_unitario,
            fecha_compra: lote.detalleCompra.fecha_compra,
            producto: {
              id_producto: lote.detalleCompra.producto.id_producto,
              nombre: lote.detalleCompra.producto.nombre,
              codigo_barra: lote.detalleCompra.producto.codigo_barra,
            },
            proveedor: {
              id_proveedor: lote.detalleCompra.proveedor.id_proveedor,
              nombre: lote.detalleCompra.proveedor.nombre,
            },
          },
        })),
      }));

      return resultado;
    } catch (error) {
      console.error(
        "Error fetching lotes agrupados por numero de lote:",
        error
      );
      throw error;
    }
  }

  async getComprasProveedor() {
    try {
      const proveedores = await Proveedor.findAll({
        attributes: ["id_proveedor", "nombre"],
        include: [
          {
            model: DetalleCompra,
            as: "detallesCompra",
            include: [
              {
                model: Lote,
                as: "lotes",
                include: [
                  {
                    model: Producto,
                    as: "producto",
                  },
                  {
                    model: Inventario,
                    as: "inventarios",
                    // where: {
                    //   cantidad: {
                    //     [Op.gt]: 0,
                    //   },
                    // },
                    // required: false,
                  },
                ],
              },
            ],
          },
        ],
        order: [["id_proveedor", "ASC"]],
      });

      return proveedores;
    } catch (error) {
      console.error("Error fetching compras por proveedor:", error);
      throw error;
    }
  }

  async getMovimientosCaja(idInicio, idFin) {
    try {
      const cajas = await Caja.findAll({
        where: {
          id_caja: {
            [Op.between]: [idInicio, idFin],
          },
        },
        include: [
          {
            model: MovimientoCaja,
            as: "movimientos",
            include: [
              {
                model: Trabajador,
                as: "trabajadorMovimiento",
              },
            ],
          },
          {
            model: Trabajador,
            as: "trabajadorCierre",
          },
        ],
      });

      return cajas;
    } catch (error) {
      console.error("Error fetching movimientos de caja:", error);
      throw error;
    }
  }

  async getVentas(idInicio, idFin) {
    try {
      const ventas = await Venta.findAll({
        where: {
          id_venta: {
            [Op.between]: [idInicio, idFin],
          },
        },
        include: [
          {
            model: Trabajador,
            as: "trabajadorVenta",
            attributes: ["nombre"],
          },
          {
            model: Cliente,
            as: "cliente",
            attributes: ["nombre", "apellido"],
          },
          {
            model: DetalleVenta,
            as: "detallesVenta",
            include: [
              {
                model: Producto,
                as: "producto",
                attributes: ["nombre"],
              },
              {
                model: Lote,
                as: "lote",
                include: [
                  {
                    model: DetalleCompra,
                    as: "detalleCompra",
                  },
                ],
              },
            ],
          },
        ],
      });
      return ventas;
    } catch (error) {
      console.error("Error fetching ventas:", error);
      throw error;
    }
  }

  async getVentasClientes() {
    try {
      const ventas = await Venta.findAll({
        attributes: [
          "id_cliente",
          [Sequelize.fn("SUM", Sequelize.col("total")), "total_gastado"],
          [Sequelize.col("cliente.id_cliente"), "cliente.id_cliente"],
          [Sequelize.col("cliente.nombre"), "cliente.nombre"],
          [Sequelize.col("cliente.apellido"), "cliente.apellido"],
        ],
        include: [
          {
            model: Cliente,
            as: "cliente",
            attributes: [
              "id_cliente",
              "nombre",
              "apellido",
              "puntos_fidelidad",
              "codigo",
            ],
          },
        ],
        group: [
          "Venta.id_cliente",
          "cliente.id_cliente",
          "cliente.nombre",
          "cliente.apellido",
          "cliente.puntos_fidelidad",
          "cliente.codigo",
        ],
        order: [[Sequelize.literal("total_gastado"), "DESC"]],
      });

      return ventas.map((venta) => ({
        id_cliente: venta.id_cliente,
        nombre: venta.cliente.nombre,
        apellido: venta.cliente.apellido,
        puntos_fidelidad: venta.cliente.puntos_fidelidad,
        codigo: venta.cliente.codigo,
        total_gastado: parseFloat(venta.dataValues.total_gastado), // Asegurar el formato numérico
      }));
    } catch (error) {
      console.error("Error fetching ventas por clientes:", error);
      throw error;
    }
  }

  async getTopClientesPorPuntos() {
    try {
      const clientes = await Cliente.findAll({
        attributes: [
          "id_cliente",
          "nombre",
          "apellido",
          "puntos_fidelidad",
          "codigo",
        ],
        order: [["puntos_fidelidad", "DESC"]],
        limit: 10,
      });

      return clientes.map((cliente) => ({
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        puntos_fidelidad: cliente.puntos_fidelidad,
        codigo: cliente.codigo,
      }));
    } catch (error) {
      console.error(
        "Error fetching top clientes por puntos de fidelidad:",
        error
      );
      throw error;
    }
  }

  async getVentasPorPagar() {
    try {
      const ventas = await Venta.findAll({
        where: {
          metodo_pago: {
            [Op.ne]: "Contado", // Filtrar donde metodo_pago no sea "Contado"
          },
        },
        include: [
          {
            model: Trabajador,
            as: "trabajadorVenta",
            attributes: ["nombre"],
          },
          {
            model: Cliente,
            as: "cliente",
            attributes: ["nombre", "apellido"],
          },
          {
            model: DetalleVenta,
            as: "detallesVenta",
            include: [
              {
                model: Producto,
                as: "producto",
                attributes: ["nombre"],
              },
              {
                model: Lote,
                as: "lote",
                include: [
                  {
                    model: DetalleCompra,
                    as: "detalleCompra",
                  },
                ],
              },
            ],
          },
        ],
      });
      return ventas;
    } catch (error) {
      console.error("Error fetching ventas:", error);
      throw error;
    }
  }

  async getVentasPorCliente(id_cliente) {
    try {
      const ventas = await Venta.findAll({
        where: {
          id_cliente: id_cliente,
        },
        include: [
          {
            model: Cliente,
            as: "cliente",
            attributes: ["nombre", "apellido"],
          },
        ],
      });
      return ventas;
    } catch (error) {
      console.error("Error fetching ventas for cliente:", error);
      throw error;
    }
  }

  async getTotalGastadoPorCliente(id_cliente) {
    try {
      const totalGastado = await Venta.findOne({
        where: {
          id_cliente: id_cliente,
        },
        attributes: [
          [Sequelize.fn("SUM", Sequelize.col("total")), "totalGastado"], // Sumar el campo 'total' de la tabla Venta
        ],
        include: [
          {
            model: Cliente,
            as: "cliente",
            attributes: ["id_cliente", "codigo", "nombre", "apellido"],
          },
        ],
        group: ["cliente.id_cliente"], // Agrupar por Cliente.id_cliente usando el alias 'cliente'
      });

      return totalGastado ? totalGastado.get() : null; // Retornar el total gastado si existe
    } catch (error) {
      console.error("Error fetching total gastado for cliente:", error);
      throw error;
    }
  }
}

module.exports = servicesReporte;
