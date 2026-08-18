const { Op } = require("sequelize");
const Producto = require("../models/Producto");
const Inventario = require("../models/Inventario");
const Lote = require("../models/Lote");
const DetalleCompra = require("../models/DetalleCompra");
const MovimientoInventario = require("../models/MovimientoInventario");

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const round2 = (value) => Number(toNumber(value).toFixed(2));

class servicesAjustes {
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
      const fechaCompra = compra.fecha_compra
        ? new Date(compra.fecha_compra).toISOString()
        : "";
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
        ? new Date(movimiento.fecha_movimiento).toISOString()
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

  async resumenAuditoria() {
    const [stock, huerfanos, negativos, comprasDuplicadas, movimientosDuplicados] =
      await Promise.all([
      this.auditarStock(),
      this.auditarInventariosHuerfanos(),
      this.auditarInventariosNegativos(),
      this.auditarComprasDuplicadas(),
      this.auditarMovimientosDuplicados(),
    ]);

    return {
      stock,
      huerfanos,
      negativos,
      comprasDuplicadas,
      movimientosDuplicados,
    };
  }
}

module.exports = servicesAjustes;
