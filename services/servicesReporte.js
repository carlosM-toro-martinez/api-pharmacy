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
const SucursalService = require("./servicesSucursal");

const sucursalService = new SucursalService();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const calcularStockInventario = (producto) => {
  const inventarios = producto?.inventarios || [];
  return inventarios.reduce(
    (totales, inventario) => ({
      stock: totales.stock + toNumber(inventario.cantidad),
      subCantidad: totales.subCantidad + toNumber(inventario.subCantidad),
      peso: totales.peso + toNumber(inventario.peso),
    }),
    { stock: 0, subCantidad: 0, peso: 0 }
  );
};

const actualizarProductoDetalleConInventario = (detalle) => {
  if (!detalle.producto) return detalle;

  const stockInventario = calcularStockInventario(detalle.producto);
  return {
    ...detalle,
    producto: {
      ...detalle.producto,
      stock: stockInventario.stock,
      subCantidad: stockInventario.subCantidad,
      peso: stockInventario.peso,
      totalCantidad: stockInventario.stock,
      totalSubCantidad: stockInventario.subCantidad,
      totalPeso: stockInventario.peso,
    },
  };
};

const ventaConProductosActualizados = (venta) => {
  const plainVenta = venta.toJSON();
  return {
    ...plainVenta,
    detallesVenta: (plainVenta.detallesVenta || []).map(
      actualizarProductoDetalleConInventario
    ),
  };
};

class servicesReporte {
  constructor() {}

  async obtenerIdSucursalOperacion(idSucursal) {
    if (idSucursal) return Number(idSucursal);
    const sucursalPrincipal = await sucursalService.obtenerSucursalPrincipal();
    return sucursalPrincipal.id_sucursal;
  }

  async getLotesConDetalleCompra(idInicio, idFin) {
    console.log(idInicio, idFin);

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

      // Agrupar lotes por id_proveedor
      const lotesAgrupadosPorProveedor = lotes.reduce((agrupados, lote) => {
        const proveedor = lote.detalleCompra?.proveedor;
        if (!proveedor) return agrupados;

        const idProveedor = proveedor.id_proveedor;
        const nombreProveedor = proveedor.nombre;

        if (!agrupados[idProveedor]) {
          agrupados[idProveedor] = {
            id_proveedor: idProveedor,
            nombre: nombreProveedor,
            lotes: [],
          };
        }

        agrupados[idProveedor].lotes.push({
          id_lote: lote.id_lote,
          numero_lote: lote.numero_lote,
          fecha_ingreso: lote.fecha_ingreso,
          fecha_caducidad: lote.fecha_caducidad,
          cantidad: lote.cantidad,
          subCantidad: lote.subCantidad,
          peso: lote.peso,
          cantidadPorCaja: lote.cantidadPorCaja,
          detalleCompra: {
            id_detalle: lote.detalleCompra.id_detalle,
            cantidad: lote.detalleCompra.cantidad,
            precio_unitario: lote.detalleCompra.precio_unitario,
            fecha_compra: lote.detalleCompra.fecha_compra,
            producto: {
              id_producto: lote.detalleCompra.producto.id_producto,
              nombre: lote.detalleCompra.producto.nombre,
              codigo_barra: lote.detalleCompra.producto.codigo_barra,
            },
          },
        });

        return agrupados;
      }, {});

      // Convertir objeto agrupado en array y ordenar por nombre del proveedor
      const resultado = Object.values(lotesAgrupadosPorProveedor).sort((a, b) =>
        a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
      );

      return resultado;
    } catch (error) {
      console.error("Error al agrupar lotes por proveedor:", error);
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

  async getMovimientosCaja(idInicio, idFin, id_sucursal = null) {
    try {
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        id_sucursal
      );
      const cajas = await Caja.findAll({
        where: {
          id_caja: {
            [Op.between]: [idInicio, idFin],
          },
          id_sucursal: idSucursalOperacion,
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

  async getVentas(idInicio, idFin, id_sucursal = null) {
    try {
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        id_sucursal
      );
      const ventas = await Venta.findAll({
        where: {
          id_venta: {
            [Op.between]: [idInicio, idFin],
          },
          id_sucursal: idSucursalOperacion,
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
                include: {
                  model: Inventario,
                  as: "inventarios",
                  attributes: ["cantidad", "subCantidad", "peso"],
                },
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
      return ventas.map(ventaConProductosActualizados);
    } catch (error) {
      console.error("Error fetching ventas:", error);
      throw error;
    }
  }

  async getVentasClientes(id_sucursal = null) {
    try {
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        id_sucursal
      );
      const ventas = await Venta.findAll({
        where: { id_sucursal: idSucursalOperacion },
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

  async getVentasPorPagar(id_sucursal = null) {
    try {
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        id_sucursal
      );
      const ventas = await Venta.findAll({
        where: {
          metodo_pago: {
            [Op.ne]: "Contado", // Filtrar donde metodo_pago no sea "Contado"
          },
          id_sucursal: idSucursalOperacion,
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
                attributes: [
                  "id_producto",
                  "nombre",
                  "stock",
                  "subCantidad",
                  "peso",
                ],
                include: {
                  model: Inventario,
                  as: "inventarios",
                  attributes: ["cantidad", "subCantidad", "peso"],
                },
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
      return ventas.map(ventaConProductosActualizados);
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

  async obtenerHistorialProducto(id_producto) {
    const compras = await DetalleCompra.findAll({
      where: { id_producto },
      include: [
        {
          model: Trabajador,
          as: "trabajadorCompra",
          attributes: ["id_trabajador", "nombre"],
        },
        {
          model: Proveedor,
          as: "proveedor",
          attributes: ["id_proveedor", "nombre"],
        },
      ],
    });

    const ventas = await DetalleVenta.findAll({
      where: { id_producto },
      include: [
        {
          model: Venta,
          as: "venta",
          attributes: ["id_venta", "fecha_venta"],
          include: [
            {
              model: Trabajador,
              as: "trabajadorVenta",
              attributes: ["id_trabajador", "nombre"],
            },
            {
              model: Cliente,
              as: "cliente",
              attributes: ["id_cliente", "nombre"],
            },
          ],
        },
      ],
    });

    const movimientos = await MovimientoInventario.findAll({
      where: {
        id_producto,
        tipo_movimiento: "Salida sin venta",
      },
      include: [
        {
          model: Trabajador,
          as: "trabajadorMovimientoInventario",
          attributes: ["id_trabajador", "nombre"],
        },
      ],
    });

    const historial = [];

    for (const compra of compras) {
      historial.push({
        tipo: "compra",
        fecha: compra.fecha_compra,
        trabajador: compra.trabajadorCompra,
        proveedor: compra.proveedor,
        detalle: {
          cantidad: compra.cantidad,
          subCantidad: compra.subCantidad,
          peso: compra.peso,
          precio_unitario: compra.precio_unitario,
        },
      });
    }

    for (const ventaDetalle of ventas) {
      historial.push({
        tipo: "venta",
        fecha: ventaDetalle.venta?.fecha_venta,
        trabajador: ventaDetalle.venta?.trabajadorVenta,
        cliente: ventaDetalle.venta?.cliente,
        detalle: {
          cantidad: ventaDetalle.cantidad,
          subCantidad: ventaDetalle.subCantidad,
          peso: ventaDetalle.peso,
          precio_unitario: ventaDetalle.precio_unitario,
        },
      });
    }

    for (const mov of movimientos) {
      historial.push({
        tipo: "movimiento",
        fecha: mov.fecha_movimiento,
        tipo_movimiento: mov.tipo_movimiento,
        trabajador: mov.trabajadorMovimientoInventario,
        detalle: {
          cantidad: mov.cantidad,
          subCantidad: mov.subCantidad,
          peso: mov.peso,
          lote: mov.lote,
        },
      });
    }

    historial.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    return historial;
  }

  async obtenerProductosMasVendidos(id_sucursal = null) {
    const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
      id_sucursal
    );
    const productos = await Producto.findAll({
      where: {
        activo: {
          [Op.ne]: false,
        },
      },
      include: [
        {
          model: Inventario,
          as: "inventarios",
          where: { id_sucursal: idSucursalOperacion },
          required: false,
          attributes: ["cantidad", "subCantidad", "peso"],
        },
        {
          model: DetalleVenta,
          as: "detallesVenta",
          attributes: [
            "id_detalle",
            "id_venta",
            "cantidad",
            "subCantidad",
            "peso",
            "precio_unitario",
          ],
          include: [
            {
              model: Venta,
              as: "venta",
              attributes: ["id_venta", "id_sucursal"],
              where: { id_sucursal: idSucursalOperacion },
              required: true,
            },
          ],
        },
      ],
    });

    const productosConVentas = productos
      .map((producto) => {
        const plainProduct = producto.toJSON();
        const inventarios = plainProduct.inventarios || [];
        const detallesVenta = plainProduct.detallesVenta || [];
        const stockInventario = inventarios.reduce(
          (totales, inventario) => ({
            stock: totales.stock + toNumber(inventario.cantidad),
            subCantidad:
              totales.subCantidad + toNumber(inventario.subCantidad),
            peso: totales.peso + toNumber(inventario.peso),
          }),
          { stock: 0, subCantidad: 0, peso: 0 }
        );

        const totalVendidas = detallesVenta.reduce(
          (acc, detalle) => acc + (detalle.cantidad || 0),
          0
        );

        const totalUnidadesVendidas = detallesVenta.reduce(
          (acc, detalle) => acc + (detalle.subCantidad || 0),
          0
        );

        return {
          ...plainProduct,
          stock: stockInventario.stock,
          subCantidad: stockInventario.subCantidad,
          peso: stockInventario.peso,
          totalCantidad: stockInventario.stock,
          totalSubCantidad: stockInventario.subCantidad,
          totalPeso: stockInventario.peso,
          totalVendidas,
          totalUnidadesVendidas,
        };
      })
      .filter(
        (producto) =>
          producto.totalVendidas > 0 || producto.totalUnidadesVendidas > 0
      );

    productosConVentas.sort(
      (a, b) => b.totalUnidadesVendidas - a.totalUnidadesVendidas
    );

    return productosConVentas;
  }
}

module.exports = servicesReporte;
