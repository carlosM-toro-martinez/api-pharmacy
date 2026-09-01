const { Op, QueryTypes } = require("sequelize");
const Producto = require("../models/Producto");
const Inventario = require("../models/Inventario");
const Lote = require("../models/Lote");
const DetalleCompra = require("../models/DetalleCompra");
const MovimientoInventario = require("../models/MovimientoInventario");
const sequelize = require("../libs/dbConexionORM");
const { toLapazISO } = require("../utils/dateUtils");

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const round2 = (value) => Number(toNumber(value).toFixed(2));

class servicesAjustes {
  getInventarioVacioWhere() {
    return {
      [Op.and]: [
        {
          [Op.or]: [{ cantidad: 0 }, { cantidad: null }],
        },
        {
          [Op.or]: [{ subCantidad: 0 }, { subCantidad: null }],
        },
        {
          [Op.or]: [{ peso: 0 }, { peso: null }],
        },
      ],
    };
  }

  getLoteVacioWhere() {
    return {
      [Op.and]: [
        {
          [Op.or]: [{ cantidad: 0 }, { cantidad: null }],
        },
        {
          [Op.or]: [{ subCantidad: 0 }, { subCantidad: null }],
        },
        {
          [Op.or]: [{ peso: 0 }, { peso: null }],
        },
      ],
    };
  }

  async calcularStockInventario(id_producto, transaction = null) {
    const inventarios = await Inventario.findAll({
      where: { id_producto },
      transaction,
    });

    return inventarios.reduce(
      (totales, inventario) => ({
        stock: totales.stock + toNumber(inventario.cantidad),
        subCantidad: totales.subCantidad + toNumber(inventario.subCantidad),
        peso: round2(totales.peso + toNumber(inventario.peso)),
      }),
      { stock: 0, subCantidad: 0, peso: 0 }
    );
  }

  tieneDiferencia(producto, inventario) {
    return (
      toNumber(producto.stock) !== toNumber(inventario.stock) ||
      toNumber(producto.subCantidad) !== toNumber(inventario.subCantidad) ||
      round2(producto.peso) !== round2(inventario.peso)
    );
  }

  crearFilaAuditoria(producto, inventario) {
    return {
      id_producto: producto.id_producto,
      nombre: producto.nombre,
      codigo_barra: producto.codigo_barra,
      producto: {
        stock: toNumber(producto.stock),
        subCantidad: toNumber(producto.subCantidad),
        peso: round2(producto.peso),
      },
      inventario,
      diferencia: {
        stock: toNumber(inventario.stock) - toNumber(producto.stock),
        subCantidad:
          toNumber(inventario.subCantidad) - toNumber(producto.subCantidad),
        peso: round2(toNumber(inventario.peso) - toNumber(producto.peso)),
      },
    };
  }

  async auditarStock() {
    const productos = await Producto.findAll({
      where: {
        activo: {
          [Op.ne]: false,
        },
      },
      order: [["nombre", "ASC"]],
    });

    const diferencias = [];

    for (const producto of productos) {
      const inventario = await this.calcularStockInventario(
        producto.id_producto
      );

      if (this.tieneDiferencia(producto, inventario)) {
        diferencias.push(this.crearFilaAuditoria(producto, inventario));
      }
    }

    return {
      totalProductos: productos.length,
      totalDiferencias: diferencias.length,
      diferencias,
    };
  }

  async sincronizarStockProducto(id_producto, transaction = null) {
    const producto = await Producto.findByPk(id_producto, { transaction });
    if (!producto) {
      throw new Error(`Producto ${id_producto} no encontrado`);
    }

    const inventario = await this.calcularStockInventario(
      id_producto,
      transaction
    );
    const antes = {
      stock: toNumber(producto.stock),
      subCantidad: toNumber(producto.subCantidad),
      peso: round2(producto.peso),
    };

    await producto.update(inventario, { transaction });

    return {
      id_producto: producto.id_producto,
      nombre: producto.nombre,
      antes,
      despues: inventario,
    };
  }

  async sincronizarTodosLosStocks() {
    const productos = await Producto.findAll({
      where: {
        activo: {
          [Op.ne]: false,
        },
      },
      attributes: ["id_producto"],
      order: [["id_producto", "ASC"]],
    });

    const resultados = [];

    for (const producto of productos) {
      const resultado = await this.sincronizarStockProducto(
        producto.id_producto
      );
      resultados.push(resultado);
    }

    return {
      totalSincronizados: resultados.length,
      resultados,
    };
  }

  async auditarInventariosHuerfanos() {
    const inventarios = await Inventario.findAll({
      include: [
        { model: Producto, as: "producto", required: false },
        { model: Lote, as: "lote", required: false },
      ],
      order: [["id_inventario", "ASC"]],
    });

    const huerfanos = inventarios
      .filter((inventario) => !inventario.producto || !inventario.lote)
      .map((inventario) => ({
        id_inventario: inventario.id_inventario,
        id_producto: inventario.id_producto,
        id_lote: inventario.id_lote,
        faltaProducto: !inventario.producto,
        faltaLote: !inventario.lote,
      }));

    return {
      totalHuerfanos: huerfanos.length,
      huerfanos,
    };
  }

  async auditarInventariosNegativos() {
    const inventarios = await Inventario.findAll({
      where: {
        [Op.or]: [
          { cantidad: { [Op.lt]: 0 } },
          { subCantidad: { [Op.lt]: 0 } },
          { peso: { [Op.lt]: 0 } },
        ],
      },
      include: [
        { model: Producto, as: "producto", required: false },
        { model: Lote, as: "lote", required: false },
      ],
      order: [["id_inventario", "ASC"]],
    });

    return {
      totalNegativos: inventarios.length,
      inventarios: inventarios.map((inventario) => ({
        id_inventario: inventario.id_inventario,
        id_producto: inventario.id_producto,
        producto: inventario.producto?.nombre,
        id_lote: inventario.id_lote,
        numero_lote: inventario.lote?.numero_lote,
        cantidad: toNumber(inventario.cantidad),
        subCantidad: toNumber(inventario.subCantidad),
        peso: round2(inventario.peso),
      })),
    };
  }

  async auditarComprasDuplicadas() {
    const compras = await DetalleCompra.findAll({
      include: [{ model: Producto, as: "producto", required: false }],
      order: [
        ["id_producto", "ASC"],
        ["fecha_compra", "ASC"],
        ["id_detalle", "ASC"],
      ],
    });

    const grupos = new Map();

    for (const compra of compras) {
      const fechaCompra = compra.fecha_compra ? toLapazISO(compra.fecha_compra) : "";
      const key = [
        compra.id_producto,
        compra.id_proveedor,
        toNumber(compra.cantidad),
        toNumber(compra.subCantidad),
        toNumber(compra.precio_unitario),
        fechaCompra,
      ].join("|");

      if (!grupos.has(key)) {
        grupos.set(key, []);
      }

      grupos.get(key).push(compra);
    }

    const duplicadas = Array.from(grupos.values())
      .filter((grupo) => grupo.length > 1)
      .map((grupo) => ({
        id_producto: grupo[0].id_producto,
        producto: grupo[0].producto?.nombre,
        id_proveedor: grupo[0].id_proveedor,
        cantidad: toNumber(grupo[0].cantidad),
        subCantidad: toNumber(grupo[0].subCantidad),
        precio_unitario: toNumber(grupo[0].precio_unitario),
        fecha_compra: grupo[0].fecha_compra,
        repeticiones: grupo.length,
        ids_detalle: grupo.map((compra) => compra.id_detalle),
      }));

    return {
      totalGruposDuplicados: duplicadas.length,
      duplicadas,
    };
  }

  async auditarMovimientosDuplicados() {
    const movimientos = await MovimientoInventario.findAll({
      include: [{ model: Producto, as: "producto", required: false }],
      order: [
        ["id_producto", "ASC"],
        ["fecha_movimiento", "ASC"],
        ["id_movimiento", "ASC"],
      ],
    });

    const grupos = new Map();

    for (const movimiento of movimientos) {
      const fechaMovimiento = movimiento.fecha_movimiento
        ? toLapazISO(movimiento.fecha_movimiento)
        : "";
      const key = [
        movimiento.id_producto,
        movimiento.lote || "",
        movimiento.tipo_movimiento,
        toNumber(movimiento.cantidad),
        toNumber(movimiento.subCantidad),
        fechaMovimiento,
      ].join("|");

      if (!grupos.has(key)) {
        grupos.set(key, []);
      }

      grupos.get(key).push(movimiento);
    }

    const duplicados = Array.from(grupos.values())
      .filter((grupo) => grupo.length > 1)
      .map((grupo) => ({
        id_producto: grupo[0].id_producto,
        producto: grupo[0].producto?.nombre,
        lote: grupo[0].lote,
        tipo_movimiento: grupo[0].tipo_movimiento,
        cantidad: toNumber(grupo[0].cantidad),
        subCantidad: toNumber(grupo[0].subCantidad),
        fecha_movimiento: grupo[0].fecha_movimiento,
        repeticiones: grupo.length,
        ids_movimiento: grupo.map((movimiento) => movimiento.id_movimiento),
      }));

    return {
      totalGruposDuplicados: duplicados.length,
      duplicados,
    };
  }

  async contarInventariosVacios(transaction = null) {
    return await Inventario.count({
      where: this.getInventarioVacioWhere(),
      transaction,
    });
  }

  async obtenerIdsLotesVaciosBorrables(transaction = null) {
    const lotes = await sequelize.query(
      `
        SELECT l."id_lote"
        FROM "Lote" l
        WHERE COALESCE(l."cantidad", 0) = 0
          AND COALESCE(l."subCantidad", 0) = 0
          AND COALESCE(l."peso", 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM "Inventario" i
            WHERE i."id_lote" = l."id_lote"
              AND (
                COALESCE(i."cantidad", 0) <> 0
                OR COALESCE(i."subCantidad", 0) <> 0
                OR COALESCE(i."peso", 0) <> 0
              )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "DetalleVenta" dv
            WHERE dv."id_lote" = l."id_lote"
          )
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    return lotes.map((lote) => lote.id_lote);
  }

  async contarLotesVaciosBorrables(transaction = null) {
    const [resultado] = await sequelize.query(
      `
        SELECT COUNT(*)::int AS total
        FROM "Lote" l
        WHERE COALESCE(l."cantidad", 0) = 0
          AND COALESCE(l."subCantidad", 0) = 0
          AND COALESCE(l."peso", 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM "Inventario" i
            WHERE i."id_lote" = l."id_lote"
              AND (
                COALESCE(i."cantidad", 0) <> 0
                OR COALESCE(i."subCantidad", 0) <> 0
                OR COALESCE(i."peso", 0) <> 0
              )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "DetalleVenta" dv
            WHERE dv."id_lote" = l."id_lote"
          )
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    return Number(resultado?.total || 0);
  }

  async resumenMantenimiento() {
    const [inventariosVacios, lotesVaciosBorrables] = await Promise.all([
      this.contarInventariosVacios(),
      this.contarLotesVaciosBorrables(),
    ]);

    return {
      inventariosVacios,
      lotesVaciosBorrables,
    };
  }

  async limpiarRegistrosVacios() {
    return await sequelize.transaction(async (transaction) => {
      const idsLotesBorrables = await this.obtenerIdsLotesVaciosBorrables(
        transaction
      );

      const inventariosEliminados = await Inventario.destroy({
        where: this.getInventarioVacioWhere(),
        transaction,
      });

      const lotesEliminados = idsLotesBorrables.length
        ? await Lote.destroy({
            where: {
              id_lote: idsLotesBorrables,
            },
            transaction,
          })
        : 0;

      return {
        message: "Mantenimiento de inventario finalizado.",
        inventariosEliminados,
        lotesEliminados,
      };
    });
  }

  async auditarProveedoresDivergentes() {
    // Un mismo producto puede tener lotes con distinto proveedor (o sin
    // proveedor) por como llego el stock (compra normal, stock inicial,
    // transferencia). Esto fragmenta el producto en varias opciones al
    // buscarlo para vender, y puede confundir cual es el stock real.
    const filas = await sequelize.query(
      `
        SELECT
          p."id_producto",
          p."nombre",
          COALESCE(dc."id_proveedor", -1) AS "id_proveedor",
          pr."nombre" AS "proveedor_nombre",
          COUNT(*)::int AS "lotes",
          SUM(
            CASE WHEN COALESCE(i."subCantidad", 0) > 0
              THEN i."subCantidad"
              ELSE COALESCE(i."cantidad", 0)
            END
          )::int AS "unidades"
        FROM "Lote" l
        INNER JOIN "Producto" p ON p."id_producto" = l."id_producto"
        INNER JOIN "Inventario" i ON i."id_lote" = l."id_lote"
        LEFT JOIN "DetalleCompra" dc ON dc."id_detalle" = l."id_detalle_compra"
        LEFT JOIN "Proveedor" pr ON pr."id_proveedor" = dc."id_proveedor"
        WHERE (COALESCE(i."subCantidad", 0) > 0 OR COALESCE(i."cantidad", 0) > 0)
          AND COALESCE(p."activo", true) <> false
        GROUP BY p."id_producto", p."nombre", COALESCE(dc."id_proveedor", -1), pr."nombre"
        ORDER BY p."id_producto"
      `,
      { type: QueryTypes.SELECT }
    );

    const porProducto = new Map();
    for (const fila of filas) {
      if (!porProducto.has(fila.id_producto)) {
        porProducto.set(fila.id_producto, {
          id_producto: fila.id_producto,
          nombre: fila.nombre,
          proveedores: [],
        });
      }
      porProducto.get(fila.id_producto).proveedores.push({
        id_proveedor: fila.id_proveedor === -1 ? null : fila.id_proveedor,
        nombre: fila.proveedor_nombre || "Sin proveedor",
        lotes: fila.lotes,
        unidades: fila.unidades,
      });
    }

    const divergentes = Array.from(porProducto.values())
      .filter((producto) => producto.proveedores.length > 1)
      .map((producto) => ({
        ...producto,
        totalUnidades: producto.proveedores.reduce(
          (total, p) => total + toNumber(p.unidades),
          0
        ),
      }))
      .sort((a, b) => b.proveedores.length - a.proveedores.length);

    return {
      totalProductos: divergentes.length,
      productos: divergentes,
    };
  }

  async resumenAuditoria() {
    // La comparacion Producto vs Inventario (auditarStock) queda fuera de
    // este resumen automatico: desde que Stock Inicial y Transferencias
    // tambien sincronizan Producto.stock/subCantidad, casi siempre va a
    // estar en cero diferencias, asi que no vale la pena recalcularla en
    // cada carga de la pagina. Se pide aparte (GET /auditoria-stock) solo
    // cuando el usuario la quiere verificar.
    const [
      huerfanos,
      negativos,
      comprasDuplicadas,
      movimientosDuplicados,
      mantenimiento,
      proveedoresDivergentes,
    ] =
      await Promise.all([
      this.auditarInventariosHuerfanos(),
      this.auditarInventariosNegativos(),
      this.auditarComprasDuplicadas(),
      this.auditarMovimientosDuplicados(),
      this.resumenMantenimiento(),
      this.auditarProveedoresDivergentes(),
    ]);

    return {
      huerfanos,
      negativos,
      comprasDuplicadas,
      movimientosDuplicados,
      mantenimiento,
      proveedoresDivergentes,
    };
  }
}

module.exports = servicesAjustes;
