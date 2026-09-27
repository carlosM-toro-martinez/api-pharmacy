const express = require("express");
const { Op, Sequelize, QueryTypes } = require("sequelize");
const { DateTime } = require("luxon");
const {
  sequelize,
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
  Sucursal,
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

const construirRangoFechas = (desde, hasta) => {
  const rango = {};
  if (desde) {
    rango[Op.gte] = DateTime.fromISO(desde, { zone: "America/La_Paz" })
      .startOf("day")
      .toJSDate();
  }
  if (hasta) {
    rango[Op.lte] = DateTime.fromISO(hasta, { zone: "America/La_Paz" })
      .endOf("day")
      .toJSDate();
  }
  return Reflect.ownKeys(rango).length ? rango : null;
};

class servicesReporte {
  constructor() {}

  async obtenerIdSucursalOperacion(idSucursal) {
    if (idSucursal) return Number(idSucursal);
    const sucursalPrincipal = await sucursalService.obtenerSucursalPrincipal();
    return sucursalPrincipal.id_sucursal;
  }

  async getReporteCompras(filters = {}) {
    const idSucursal = Number(filters.id_sucursal);
    const filtrarPorSucursal = Number.isFinite(idSucursal) && idSucursal > 0;
    const where = {};
    const rangoFechas = construirRangoFechas(filters.desde, filters.hasta);
    if (rangoFechas) where.fecha_compra = rangoFechas;
    const numeroFactura = String(filters.numero_factura || "").trim();
    if (numeroFactura) {
      where.numero_factura = { [Op.iLike]: `%${numeroFactura}%` };
    }

    // Sequelize aplica mal el LIMIT cuando se combina con un include hasMany
    // (ignora el WHERE y devuelve filas de más): primero se resuelven los IDs
    // ya acotados por fecha/sucursal, y recién ahí se cargan los datos
    // completos para esos IDs puntuales.
    const comprasIds = await DetalleCompra.findAll({
      where,
      attributes: ["id_detalle"],
      include: filtrarPorSucursal
        ? [
            {
              model: Lote,
              as: "lotes",
              attributes: [],
              required: true,
              include: [
                {
                  model: Inventario,
                  as: "inventarios",
                  attributes: [],
                  required: true,
                  where: { id_sucursal: idSucursal },
                },
              ],
            },
          ]
        : [],
      order: [["fecha_compra", "DESC"]],
      limit: 1000,
      subQuery: false,
      distinct: true,
    });

    const ids = comprasIds.map((compra) => compra.id_detalle);
    if (!ids.length) return [];

    const compras = await DetalleCompra.findAll({
      where: { id_detalle: ids },
      include: [
        {
          model: Producto,
          as: "producto",
          attributes: [
            "id_producto",
            "nombre",
            "codigo_barra",
            "concentracion",
            "forma_farmaceutica",
          ],
        },
        {
          model: Proveedor,
          as: "proveedor",
          attributes: ["id_proveedor", "nombre"],
        },
        {
          model: Proveedor,
          as: "proveedorFactura",
          attributes: ["id_proveedor", "nombre"],
        },
        {
          model: Trabajador,
          as: "trabajadorCompra",
          attributes: ["id_trabajador", "nombre", "apellido_paterno"],
        },
        {
          model: Lote,
          as: "lotes",
          attributes: ["id_lote", "numero_lote", "fecha_caducidad"],
          separate: true,
          include: [
            {
              model: Inventario,
              as: "inventarios",
              attributes: ["id_sucursal"],
            },
          ],
        },
      ],
      order: [["fecha_compra", "DESC"]],
    });

    return compras;
  }

  async getReporteCajas(filters = {}) {
    const idSucursal = Number(filters.id_sucursal);
    const where = {};
    if (Number.isFinite(idSucursal) && idSucursal > 0) {
      where.id_sucursal = idSucursal;
    }
    const rangoFechas = construirRangoFechas(filters.desde, filters.hasta);
    if (rangoFechas) where.fecha_apertura = rangoFechas;

    const cajas = await Caja.findAll({
      where,
      include: [
        {
          model: MovimientoCaja,
          as: "movimientos",
          separate: true,
          include: [
            {
              model: Trabajador,
              as: "trabajadorMovimiento",
              attributes: ["id_trabajador", "nombre", "apellido_paterno"],
            },
          ],
        },
        {
          model: Trabajador,
          as: "trabajadorCierre",
          attributes: ["id_trabajador", "nombre", "apellido_paterno"],
        },
        {
          model: Sucursal,
          as: "sucursal",
          attributes: ["id_sucursal", "nombre"],
        },
      ],
      order: [["fecha_apertura", "DESC"]],
      limit: 500,
    });

    return cajas;
  }

  async getReporteVentasPorFecha(filters = {}) {
    const idSucursal = Number(filters.id_sucursal);
    const where = {};
    if (Number.isFinite(idSucursal) && idSucursal > 0) {
      where.id_sucursal = idSucursal;
    }
    const rangoFechas = construirRangoFechas(filters.desde, filters.hasta);
    if (rangoFechas) where.fecha_venta = rangoFechas;

    const ventas = await Venta.findAll({
      where,
      include: [
        {
          model: Trabajador,
          as: "trabajadorVenta",
          attributes: ["id_trabajador", "nombre", "apellido_paterno"],
        },
        {
          model: Cliente,
          as: "cliente",
          attributes: ["nombre", "apellido"],
        },
        {
          model: Sucursal,
          as: "sucursal",
          attributes: ["id_sucursal", "nombre"],
        },
        {
          model: DetalleVenta,
          as: "detallesVenta",
          separate: true,
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
      order: [["fecha_venta", "DESC"]],
      limit: 2000,
    });
    return ventas.map(ventaConProductosActualizados);
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
            attributes: ["id_trabajador", "nombre", "apellido_paterno"],
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

  async obtenerHistorialProducto(id_producto, filters = {}) {
    const idSucursal = Number(filters.id_sucursal);
    const filtrarPorSucursal = Number.isFinite(idSucursal) && idSucursal > 0;

    const compras = await DetalleCompra.findAll({
      where: { id_producto },
      distinct: true,
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
        {
          model: Lote,
          as: "lotes",
          attributes: [],
          required: filtrarPorSucursal,
          include: filtrarPorSucursal
            ? [
                {
                  model: Inventario,
                  as: "inventarios",
                  attributes: [],
                  required: true,
                  where: { id_sucursal: idSucursal },
                },
              ]
            : [],
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
          required: filtrarPorSucursal,
          where: filtrarPorSucursal ? { id_sucursal: idSucursal } : undefined,
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

    // Antes solo se incluía "Salida sin venta", dejando afuera las
    // transferencias entre sucursales — el saldo reconstruido (ver
    // HistoryProductComponent en el frontend) partía del stock real actual
    // y restaba/sumaba únicamente los movimientos de esta lista, así que
    // cualquier transferencia (no visible aquí) generaba un descuadre que
    // podía mostrarse como cantidades negativas en el historial.
    const movimientosWhere = {
      id_producto,
      tipo_movimiento: {
        [Op.in]: [
          "Salida sin venta",
          "Transferencia salida",
          "Transferencia entrada",
        ],
      },
    };
    if (filtrarPorSucursal) movimientosWhere.id_sucursal = idSucursal;

    const movimientos = await MovimientoInventario.findAll({
      where: movimientosWhere,
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

    const inventarioWhere = { id_producto };
    if (filtrarPorSucursal) inventarioWhere.id_sucursal = idSucursal;
    const inventarios = await Inventario.findAll({
      where: inventarioWhere,
      attributes: ["cantidad", "subCantidad", "peso"],
    });
    const stock = inventarios.reduce(
      (totales, inventario) => ({
        cantidad: totales.cantidad + toNumber(inventario.cantidad),
        subCantidad: totales.subCantidad + toNumber(inventario.subCantidad),
        peso: totales.peso + toNumber(inventario.peso),
      }),
      { cantidad: 0, subCantidad: 0, peso: 0 }
    );

    return { historial, stock };
  }

  async obtenerProductosMasVendidos(filters = {}) {
    const idSucursal = Number(filters.id_sucursal);
    const idSucursalFiltro =
      Number.isFinite(idSucursal) && idSucursal > 0 ? idSucursal : null;
    const desde = filters.desde
      ? DateTime.fromISO(filters.desde, { zone: "America/La_Paz" })
          .startOf("day")
          .toJSDate()
      : null;
    const hasta = filters.hasta
      ? DateTime.fromISO(filters.hasta, { zone: "America/La_Paz" })
          .endOf("day")
          .toJSDate()
      : null;
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);

    const productos = await sequelize.query(
      `
        SELECT
          p."id_producto",
          p."nombre",
          p."codigo_barra",
          p."precio",
          p."concentracion",
          p."forma_farmaceutica",
          SUM(dv."cantidad")::int AS "totalCantidad",
          SUM(dv."subCantidad")::int AS "totalUnidadesVendidas",
          COUNT(DISTINCT dv."id_venta")::int AS "totalVentas"
        FROM "DetalleVenta" dv
        INNER JOIN "Venta" v ON v."id_venta" = dv."id_venta"
        INNER JOIN "Producto" p ON p."id_producto" = dv."id_producto"
        WHERE COALESCE(p."activo", true) <> false
          AND (:desde::timestamp IS NULL OR v."fecha_venta" >= :desde)
          AND (:hasta::timestamp IS NULL OR v."fecha_venta" <= :hasta)
          AND (:idSucursal::int IS NULL OR v."id_sucursal" = :idSucursal)
        GROUP BY
          p."id_producto", p."nombre", p."codigo_barra", p."precio",
          p."concentracion", p."forma_farmaceutica"
        ORDER BY "totalUnidadesVendidas" DESC
        LIMIT :limit
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { desde, hasta, idSucursal: idSucursalFiltro, limit },
      }
    );

    if (!productos.length) return productos;

    const ids = productos.map((producto) => producto.id_producto);
    const stockPorProducto = await sequelize.query(
      `
        SELECT
          "id_producto",
          SUM("cantidad")::int AS stock,
          SUM("subCantidad")::int AS "subCantidad"
        FROM "Inventario"
        WHERE "id_producto" IN (:ids)
          AND (:idSucursal::int IS NULL OR "id_sucursal" = :idSucursal)
        GROUP BY "id_producto"
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { ids, idSucursal: idSucursalFiltro },
      }
    );
    const stockPorId = new Map(
      stockPorProducto.map((fila) => [fila.id_producto, fila])
    );

    return productos.map((producto) => ({
      ...producto,
      stock: stockPorId.get(producto.id_producto)?.stock || 0,
      subCantidad: stockPorId.get(producto.id_producto)?.subCantidad || 0,
    }));
  }
}

module.exports = servicesReporte;
