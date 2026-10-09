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

  // Antes esta funcion borraba directamente los inventarios en cero y los
  // lotes vacios sin ventas asociadas. Eso resulto destruir la unica
  // evidencia de descuadres reales: un lote puede llegar a stock real
  // (creado por ejemplo via los endpoints genericos POST /lotes o
  // POST /inventario, que no generan compra ni movimiento) y luego vaciarse
  // por una "Salida sin venta" sin haber tenido nunca una venta asociada;
  // al no tener DetalleVenta, calificaba como "borrable" y desaparecia sin
  // dejar rastro, dejando al historial con una resta sin su suma. Ahora solo
  // se lista para revision manual; no se elimina nada automaticamente.
  async revisarRegistrosVacios() {
    const idsLotesBorrables = await this.obtenerIdsLotesVaciosBorrables();

    const inventariosVacios = await sequelize.query(
      `
        SELECT
          i."id_inventario",
          i."id_producto",
          p."nombre" AS producto,
          i."id_lote",
          l."numero_lote",
          i."id_sucursal",
          s."nombre" AS sucursal,
          EXISTS (
            SELECT 1 FROM "MovimientoInventario" m
            WHERE m."lote" = i."id_lote"::text
          ) AS "tieneMovimientoAsociado"
        FROM "Inventario" i
        JOIN "Producto" p ON p."id_producto" = i."id_producto"
        LEFT JOIN "Lote" l ON l."id_lote" = i."id_lote"
        LEFT JOIN "Sucursal" s ON s."id_sucursal" = i."id_sucursal"
        WHERE COALESCE(i."cantidad", 0) = 0
          AND COALESCE(i."subCantidad", 0) = 0
          AND COALESCE(i."peso", 0) = 0
        ORDER BY "tieneMovimientoAsociado" DESC, p."nombre" ASC
      `,
      { type: QueryTypes.SELECT }
    );

    const lotesVaciosBorrables = idsLotesBorrables.length
      ? await sequelize.query(
          `
            SELECT
              l."id_lote",
              l."numero_lote",
              l."id_producto",
              p."nombre" AS producto,
              EXISTS (
                SELECT 1 FROM "MovimientoInventario" m
                WHERE m."lote" = l."id_lote"::text
              ) AS "tieneMovimientoAsociado"
            FROM "Lote" l
            JOIN "Producto" p ON p."id_producto" = l."id_producto"
            WHERE l."id_lote" IN (:ids)
            ORDER BY "tieneMovimientoAsociado" DESC, p."nombre" ASC
          `,
          { type: QueryTypes.SELECT, replacements: { ids: idsLotesBorrables } }
        )
      : [];

    const totalConMovimientoAsociado =
      inventariosVacios.filter((fila) => fila.tieneMovimientoAsociado).length +
      lotesVaciosBorrables.filter((fila) => fila.tieneMovimientoAsociado)
        .length;

    return {
      totalInventariosVacios: inventariosVacios.length,
      totalLotesVaciosBorrables: lotesVaciosBorrables.length,
      totalConMovimientoAsociado,
      inventariosVacios,
      lotesVaciosBorrables,
    };
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

  // Compara, para cada producto Y SUCURSAL por separado, el stock real
  // (suma de Inventario) contra lo que deberia haber segun el libro mayor
  // real: compras (incluye la compra "sintetica" que genera cada
  // transferencia, porque esa si representa una entrada real a esa
  // sucursal) menos ventas, menos salidas sin venta, menos lo que salio
  // de esa sucursal por transferencia. Es deliberadamente por sucursal
  // (no solo el total del producto): un lote puede estar mal aunque el
  // total del producto cuadre, si el descuadre esta en una sucursal y se
  // compensa con otra.
  async auditarDescuadreStock() {
    const filas = await sequelize.query(
      `
        WITH inventario_real AS (
          SELECT i."id_producto", i."id_sucursal", s."nombre" AS "sucursal",
            SUM(COALESCE(i."subCantidad", 0)) AS "stockReal"
          FROM "Inventario" i
          JOIN "Sucursal" s ON s."id_sucursal" = i."id_sucursal"
          GROUP BY i."id_producto", i."id_sucursal", s."nombre"
        ),
        compras AS (
          SELECT i."id_producto", i."id_sucursal",
            SUM(COALESCE(dc."subCantidad", 0)) AS "totalCompras"
          FROM "DetalleCompra" dc
          JOIN "Lote" l ON l."id_detalle_compra" = dc."id_detalle"
          JOIN "Inventario" i ON i."id_lote" = l."id_lote"
          GROUP BY i."id_producto", i."id_sucursal"
        ),
        ventas AS (
          SELECT v."id_sucursal", dv."id_producto",
            SUM(COALESCE(dv."subCantidad", 0)) AS "totalVentas"
          FROM "DetalleVenta" dv
          JOIN "Venta" v ON v."id_venta" = dv."id_venta"
          GROUP BY v."id_sucursal", dv."id_producto"
        ),
        salidas AS (
          SELECT "id_sucursal", "id_producto",
            SUM(COALESCE("subCantidad", 0)) AS "totalSalidas"
          FROM "MovimientoInventario"
          WHERE "tipo_movimiento" = 'Salida sin venta'
          GROUP BY "id_sucursal", "id_producto"
        ),
        transferenciasSalida AS (
          SELECT "id_sucursal", "id_producto",
            SUM(COALESCE("subCantidad", 0)) AS "totalTransferenciaSalida"
          FROM "MovimientoInventario"
          WHERE "tipo_movimiento" = 'Transferencia salida'
          GROUP BY "id_sucursal", "id_producto"
        ),
        -- Lotes sin ninguna compra detras (id_detalle_compra NULL): stock
        -- que entro por una via que no es "comprar" (ej. saldo inicial
        -- cargado manualmente al dar de alta un producto o sucursal, antes
        -- de que existiera un proveedor/precio para registrarlo como
        -- compra). Lote.subCantidad nunca se actualiza despues de creado
        -- (solo Inventario.subCantidad baja con las ventas), asi que es la
        -- cantidad ORIGINAL con la que entro ese lote, igual que
        -- DetalleCompra.subCantidad para una compra normal.
        saldoInicial AS (
          SELECT i."id_producto", i."id_sucursal",
            SUM(COALESCE(l."subCantidad", 0)) AS "totalSaldoInicial"
          FROM "Lote" l
          JOIN "Inventario" i ON i."id_lote" = l."id_lote"
          WHERE l."id_detalle_compra" IS NULL
          GROUP BY i."id_producto", i."id_sucursal"
        ),
        -- Caso de los lotes ya borrados por la vieja limpieza automatica
        -- (ver revisarRegistrosVacios): su Lote ya no existe, pero el
        -- movimiento que los vacio ("Salida sin venta" o "Transferencia
        -- salida") sigue apuntando a ese id_lote como texto en la columna
        -- "lote". Si ese id ya no corresponde a ningun Lote actual, es
        -- saldo inicial fantasma: la cantidad que se resto aqui nunca se
        -- sumo como compra ni como saldo inicial (porque su fila ya no
        -- existe), asi que hay que recuperarla igual para no quedar como
        -- "descuadre" permanente.
        loteFantasma AS (
          SELECT m."id_producto", m."id_sucursal",
            SUM(COALESCE(m."subCantidad", 0)) AS "totalSaldoInicialFantasma"
          FROM "MovimientoInventario" m
          WHERE m."tipo_movimiento" IN ('Salida sin venta', 'Transferencia salida')
            AND m."lote" ~ '^[0-9]+$'
            AND NOT EXISTS (
              SELECT 1 FROM "Lote" l WHERE l."id_lote" = m."lote"::int
            )
          GROUP BY m."id_producto", m."id_sucursal"
        )
        SELECT
          p."id_producto", p."nombre", p."codigo_barra",
          ir."id_sucursal", ir."sucursal",
          ir."stockReal" AS "stockReal",
          COALESCE(c."totalCompras", 0) AS "totalCompras",
          (
            COALESCE(si."totalSaldoInicial", 0)
            + COALESCE(lf."totalSaldoInicialFantasma", 0)
          ) AS "totalSaldoInicial",
          (
            COALESCE(c."totalCompras", 0)
            + COALESCE(si."totalSaldoInicial", 0)
            + COALESCE(lf."totalSaldoInicialFantasma", 0)
            - COALESCE(v."totalVentas", 0)
            - COALESCE(sa."totalSalidas", 0)
            - COALESCE(ts."totalTransferenciaSalida", 0)
          ) AS "stockEsperado"
        FROM inventario_real ir
        JOIN "Producto" p ON p."id_producto" = ir."id_producto"
        LEFT JOIN compras c ON c."id_producto" = ir."id_producto" AND c."id_sucursal" = ir."id_sucursal"
        LEFT JOIN ventas v ON v."id_producto" = ir."id_producto" AND v."id_sucursal" = ir."id_sucursal"
        LEFT JOIN salidas sa ON sa."id_producto" = ir."id_producto" AND sa."id_sucursal" = ir."id_sucursal"
        LEFT JOIN transferenciasSalida ts ON ts."id_producto" = ir."id_producto" AND ts."id_sucursal" = ir."id_sucursal"
        LEFT JOIN saldoInicial si ON si."id_producto" = ir."id_producto" AND si."id_sucursal" = ir."id_sucursal"
        LEFT JOIN loteFantasma lf ON lf."id_producto" = ir."id_producto" AND lf."id_sucursal" = ir."id_sucursal"
        WHERE COALESCE(p."activo", true) <> false
        ORDER BY p."nombre", ir."sucursal"
      `,
      { type: QueryTypes.SELECT }
    );

    const conDiferencia = filas
      .map((fila) => ({
        id_producto: fila.id_producto,
        nombre: fila.nombre,
        codigo_barra: fila.codigo_barra,
        id_sucursal: fila.id_sucursal,
        sucursal: fila.sucursal,
        stockReal: toNumber(fila.stockReal),
        stockEsperado: toNumber(fila.stockEsperado),
        totalCompras: toNumber(fila.totalCompras),
        totalSaldoInicial: toNumber(fila.totalSaldoInicial),
        diferencia: round2(toNumber(fila.stockReal) - toNumber(fila.stockEsperado)),
      }))
      .filter((fila) => Math.abs(fila.diferencia) > 0.01)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

    return {
      totalFilasRevisadas: filas.length,
      totalConDiferencia: conDiferencia.length,
      diferencias: conDiferencia,
    };
  }

  // Detalle por LOTE (no por producto+sucursal) de donde sale cada
  // diferencia que encuentra auditarDescuadreStock(): un lote cuyas ventas
  // + salidas superan lo que se compro para el. Como Inventario no puede
  // bajar de 0 (decrementar() revienta antes), un lote sobrevendido queda
  // en 0 en vez del negativo que matematicamente le corresponderia, y esa
  // diferencia es justamente lo que hace que el stock real de todo el
  // producto/sucursal quede por encima de lo esperado.
  async auditarLotesSobrevendidos() {
    const filas = await sequelize.query(
      `
        WITH vendidos AS (
          SELECT "id_lote", SUM(COALESCE("subCantidad", 0)) AS "vendido"
          FROM "DetalleVenta"
          GROUP BY "id_lote"
        ),
        salidas AS (
          SELECT "lote"::int AS "id_lote", SUM(COALESCE("subCantidad", 0)) AS "salida"
          FROM "MovimientoInventario"
          WHERE "tipo_movimiento" IN ('Salida sin venta', 'Transferencia salida')
            AND "lote" ~ '^[0-9]+$'
          GROUP BY "lote"::int
        )
        SELECT
          p."id_producto", p."nombre", p."codigo_barra",
          s."id_sucursal", s."nombre" AS "sucursal",
          l."id_lote", l."numero_lote", dc."fecha_compra",
          dc."subCantidad" AS "comprado",
          COALESCE(v."vendido", 0) AS "vendido",
          COALESCE(sa."salida", 0) AS "salida",
          COALESCE(i."subCantidad", 0) AS "stockReal",
          (COALESCE(v."vendido", 0) + COALESCE(sa."salida", 0) - dc."subCantidad") AS "sobreventa"
        FROM "Lote" l
        JOIN "DetalleCompra" dc ON dc."id_detalle" = l."id_detalle_compra"
        JOIN "Producto" p ON p."id_producto" = l."id_producto"
        JOIN "Inventario" i ON i."id_lote" = l."id_lote"
        JOIN "Sucursal" s ON s."id_sucursal" = i."id_sucursal"
        LEFT JOIN vendidos v ON v."id_lote" = l."id_lote"
        LEFT JOIN salidas sa ON sa."id_lote" = l."id_lote"
        WHERE (COALESCE(v."vendido", 0) + COALESCE(sa."salida", 0)) > dc."subCantidad"
          AND COALESCE(p."activo", true) <> false
        ORDER BY "sobreventa" DESC
      `,
      { type: QueryTypes.SELECT }
    );

    return {
      totalLotesSobrevendidos: filas.length,
      lotes: filas.map((fila) => ({
        id_producto: fila.id_producto,
        nombre: fila.nombre,
        codigo_barra: fila.codigo_barra,
        id_sucursal: fila.id_sucursal,
        sucursal: fila.sucursal,
        id_lote: fila.id_lote,
        numero_lote: fila.numero_lote,
        fecha_compra: fila.fecha_compra,
        comprado: toNumber(fila.comprado),
        vendido: toNumber(fila.vendido),
        salida: toNumber(fila.salida),
        stockReal: toNumber(fila.stockReal),
        sobreventa: toNumber(fila.sobreventa),
      })),
    };
  }

  // Lista, por producto+sucursal, cuanto stock se desconto de mas por
  // ventas con una linea de DetalleVenta duplicada (mismo producto+lote
  // repetido en una sola venta: se creaba la fila dos veces y el
  // inventario se restaba dos veces, aunque el cliente pago una sola vez).
  // Que la fila este duplicada es un HECHO confirmado (son filas identicas
  // de verdad en la base) — pero cuanto de ese stock sigue realmente
  // faltando HOY no es tan simple como sumar "stock real + duplicado": si
  // despues del duplicado se hizo una "Salida sin venta" por CUALQUIER otro
  // motivo (producto vencido, rotura, etc.), esa salida igual hay que
  // restarla, y si el producto tiene ademas otro problema (ej. un lote
  // sobrevendido por la condicion de carrera que ya se corrigio), el
  // faltante real puede ser mayor al que explica solo la duplicacion.
  //
  // Por eso "stockEsperado" ACA se calcula con el mismo libro mayor
  // completo que auditarDescuadreStock() (compras + saldo inicial + lotes
  // fantasma - TODAS las salidas/transferencias), pero contando cada venta
  // UNA sola vez aunque este duplicada en la tabla (asi es como deberia
  // haber quedado si el bug nunca hubiera pasado). La diferencia contra el
  // stock real de hoy es el faltante real pendiente — ya neto de cualquier
  // otro ajuste que se haya hecho desde entonces, sea por esta causa o por
  // otra. Verificado contra los datos reales: de 219 productos con ventas
  // duplicadas, 211 siguen con un faltante real (algunos mayor al que
  // explica solo la duplicacion, por tener otro problema encima) y 8 ya no
  // tienen faltante pendiente — esos se excluyen de la lista.
  async auditarVentasDuplicadas(filters = {}) {
    const anio = Number(filters.anio);
    const filtrarPorAnio = Number.isFinite(anio) && anio > 0;

    const filas = await sequelize.query(
      `
        WITH ventas_unicas AS (
          SELECT DISTINCT "id_venta", "id_producto", "id_lote", "cantidad", "subCantidad", "precio_unitario"
          FROM "DetalleVenta"
        ),
        ventasPorProductoSucursal AS (
          SELECT v."id_sucursal", vu."id_producto",
            SUM(COALESCE(vu."subCantidad", 0)) AS "totalVentas"
          FROM ventas_unicas vu
          JOIN "Venta" v ON v."id_venta" = vu."id_venta"
          GROUP BY v."id_sucursal", vu."id_producto"
        ),
        inventario_real AS (
          SELECT "id_producto", "id_sucursal", SUM(COALESCE("subCantidad", 0)) AS "stockReal"
          FROM "Inventario"
          GROUP BY "id_producto", "id_sucursal"
        ),
        compras AS (
          SELECT i."id_producto", i."id_sucursal",
            SUM(COALESCE(dc."subCantidad", 0)) AS "totalCompras"
          FROM "DetalleCompra" dc
          JOIN "Lote" l ON l."id_detalle_compra" = dc."id_detalle"
          JOIN "Inventario" i ON i."id_lote" = l."id_lote"
          GROUP BY i."id_producto", i."id_sucursal"
        ),
        salidas AS (
          SELECT "id_sucursal", "id_producto",
            SUM(COALESCE("subCantidad", 0)) AS "totalSalidas"
          FROM "MovimientoInventario"
          WHERE "tipo_movimiento" = 'Salida sin venta'
          GROUP BY "id_sucursal", "id_producto"
        ),
        transferenciasSalida AS (
          SELECT "id_sucursal", "id_producto",
            SUM(COALESCE("subCantidad", 0)) AS "totalTransferenciaSalida"
          FROM "MovimientoInventario"
          WHERE "tipo_movimiento" = 'Transferencia salida'
          GROUP BY "id_sucursal", "id_producto"
        ),
        saldoInicial AS (
          SELECT i."id_producto", i."id_sucursal",
            SUM(COALESCE(l."subCantidad", 0)) AS "totalSaldoInicial"
          FROM "Lote" l
          JOIN "Inventario" i ON i."id_lote" = l."id_lote"
          WHERE l."id_detalle_compra" IS NULL
          GROUP BY i."id_producto", i."id_sucursal"
        ),
        loteFantasma AS (
          SELECT m."id_producto", m."id_sucursal",
            SUM(COALESCE(m."subCantidad", 0)) AS "totalSaldoInicialFantasma"
          FROM "MovimientoInventario" m
          WHERE m."tipo_movimiento" IN ('Salida sin venta', 'Transferencia salida')
            AND m."lote" ~ '^[0-9]+$'
            AND NOT EXISTS (
              SELECT 1 FROM "Lote" l WHERE l."id_lote" = m."lote"::int
            )
          GROUP BY m."id_producto", m."id_sucursal"
        ),
        duplicados AS (
          SELECT "id_venta", "id_producto", "id_lote", "cantidad", "subCantidad", "precio_unitario",
            COUNT(*) AS "repeticiones"
          FROM "DetalleVenta"
          GROUP BY "id_venta", "id_producto", "id_lote", "cantidad", "subCantidad", "precio_unitario"
          HAVING COUNT(*) > 1
        ),
        -- El filtro de anio (si se pide) acota CUALES incidentes de
        -- duplicado se listan, pero el faltante real (stockReal vs
        -- stockEsperadoSinDuplicado abajo) siempre se calcula con el
        -- historial COMPLETO: el stock actual no "sabe" de que anio es el
        -- hueco, asi que filtrar esa parte por anio daria un numero falso.
        duplicadosFiltrados AS (
          SELECT d.*, v."fecha_venta", v."id_sucursal"
          FROM duplicados d
          JOIN "Venta" v ON v."id_venta" = d."id_venta"
          ${filtrarPorAnio ? `WHERE EXTRACT(YEAR FROM v."fecha_venta") = :anio` : ""}
        ),
        resumenDuplicados AS (
          SELECT df."id_producto", p."nombre", p."codigo_barra",
            p."forma_farmaceutica", p."concentracion",
            df."id_sucursal", s."nombre" AS "sucursal",
            SUM((df."repeticiones" - 1) * df."subCantidad")::int AS "unidadesDescontadasDeMas",
            COUNT(*)::int AS "cantidadVentasAfectadas",
            MAX(df."fecha_venta") AS "fechaMasReciente"
          FROM duplicadosFiltrados df
          JOIN "Producto" p ON p."id_producto" = df."id_producto" AND COALESCE(p."activo", true) <> false
          JOIN "Sucursal" s ON s."id_sucursal" = df."id_sucursal"
          GROUP BY df."id_producto", p."nombre", p."codigo_barra", p."forma_farmaceutica",
            p."concentracion", df."id_sucursal", s."nombre"
        ),
        -- Lote de la duplicacion mas reciente de cada producto+sucursal, para
        -- mostrar a que proveedor correspondia (un producto puede tener
        -- lotes de varios proveedores distintos, asi que no hay un
        -- "proveedor del producto" unico — se muestra el del caso mas
        -- reciente, el mismo que ya se usa para "fechaMasReciente").
        loteMasReciente AS (
          SELECT DISTINCT ON (df."id_producto", df."id_sucursal")
            df."id_producto", df."id_sucursal", df."id_lote"
          FROM duplicadosFiltrados df
          ORDER BY df."id_producto", df."id_sucursal", df."fecha_venta" DESC
        ),
        proveedorMasReciente AS (
          SELECT lmr."id_producto", lmr."id_sucursal", pr."nombre" AS "proveedor"
          FROM loteMasReciente lmr
          LEFT JOIN "Lote" l ON l."id_lote" = lmr."id_lote"
          LEFT JOIN "DetalleCompra" dc ON dc."id_detalle" = l."id_detalle_compra"
          LEFT JOIN "Proveedor" pr ON pr."id_proveedor" = dc."id_proveedor"
        )
        SELECT
          rd.*,
          pmr."proveedor",
          COALESCE(ir."stockReal", 0) AS "stockReal",
          (
            COALESCE(c."totalCompras", 0)
            + COALESCE(si."totalSaldoInicial", 0)
            + COALESCE(lf."totalSaldoInicialFantasma", 0)
            - COALESCE(v."totalVentas", 0)
            - COALESCE(sa."totalSalidas", 0)
            - COALESCE(ts."totalTransferenciaSalida", 0)
          ) AS "stockEsperadoSinDuplicado"
        FROM resumenDuplicados rd
        LEFT JOIN proveedorMasReciente pmr ON pmr."id_producto" = rd."id_producto" AND pmr."id_sucursal" = rd."id_sucursal"
        LEFT JOIN inventario_real ir ON ir."id_producto" = rd."id_producto" AND ir."id_sucursal" = rd."id_sucursal"
        LEFT JOIN compras c ON c."id_producto" = rd."id_producto" AND c."id_sucursal" = rd."id_sucursal"
        LEFT JOIN ventasPorProductoSucursal v ON v."id_producto" = rd."id_producto" AND v."id_sucursal" = rd."id_sucursal"
        LEFT JOIN salidas sa ON sa."id_producto" = rd."id_producto" AND sa."id_sucursal" = rd."id_sucursal"
        LEFT JOIN transferenciasSalida ts ON ts."id_producto" = rd."id_producto" AND ts."id_sucursal" = rd."id_sucursal"
        LEFT JOIN saldoInicial si ON si."id_producto" = rd."id_producto" AND si."id_sucursal" = rd."id_sucursal"
        LEFT JOIN loteFantasma lf ON lf."id_producto" = rd."id_producto" AND lf."id_sucursal" = rd."id_sucursal"
      `,
      {
        type: QueryTypes.SELECT,
        replacements: filtrarPorAnio ? { anio } : {},
      }
    );

    const productos = filas
      .map((fila) => {
        const stockReal = toNumber(fila.stockReal);
        const stockEsperadoSinDuplicado = toNumber(fila.stockEsperadoSinDuplicado);
        // Positivo = todavia falta esa cantidad en el sistema. Si da 0 o
        // negativo, el faltante de esta duplicacion ya no esta pendiente
        // (se compenso con otro movimiento posterior, por la razon que sea).
        const faltanteReal = Math.max(
          0,
          Math.round((stockEsperadoSinDuplicado - stockReal) * 100) / 100
        );
        return {
          id_producto: fila.id_producto,
          nombre: fila.nombre,
          codigo_barra: fila.codigo_barra,
          forma_farmaceutica: fila.forma_farmaceutica,
          concentracion: fila.concentracion,
          proveedor: fila.proveedor,
          id_sucursal: fila.id_sucursal,
          sucursal: fila.sucursal,
          unidadesDescontadasDeMas: toNumber(fila.unidadesDescontadasDeMas),
          cantidadVentasAfectadas: toNumber(fila.cantidadVentasAfectadas),
          fechaMasReciente: fila.fechaMasReciente,
          stockReal,
          faltanteReal,
          stockSugerido: Math.round((stockReal + faltanteReal) * 100) / 100,
        };
      })
      .filter((p) => p.faltanteReal > 0.01)
      .sort((a, b) => b.faltanteReal - a.faltanteReal);

    // Lista de años con al menos un incidente de venta duplicada, para
    // armar el filtro del frontend. Siempre sale del historial completo
    // (no del filtro actual), para que el dropdown no se achique solo.
    const aniosFilas = await sequelize.query(
      `
        SELECT DISTINCT EXTRACT(YEAR FROM v."fecha_venta")::int AS "anio"
        FROM "DetalleVenta" dv
        JOIN "Venta" v ON v."id_venta" = dv."id_venta"
        WHERE (dv."id_venta", dv."id_producto", dv."id_lote", dv."cantidad", dv."subCantidad", dv."precio_unitario") IN (
          SELECT "id_venta", "id_producto", "id_lote", "cantidad", "subCantidad", "precio_unitario"
          FROM "DetalleVenta"
          GROUP BY "id_venta", "id_producto", "id_lote", "cantidad", "subCantidad", "precio_unitario"
          HAVING COUNT(*) > 1
        )
        ORDER BY "anio" DESC
      `,
      { type: QueryTypes.SELECT }
    );

    return {
      totalProductosAfectados: productos.length,
      totalUnidadesDescontadasDeMas: productos.reduce(
        (total, p) => total + p.faltanteReal,
        0
      ),
      aniosDisponibles: aniosFilas.map((f) => f.anio),
      productos,
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
