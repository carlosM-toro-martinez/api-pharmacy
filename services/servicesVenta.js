const sequelize = require("../libs/dbConexionORM");
const Venta = require("../models/Venta");
const Caja = require("../models/Caja");
const MovimientoCaja = require("../models/MovimientoCaja");
const DetalleVenta = require("../models/DetalleVenta");
const Inventario = require("../models/Inventario");
const Producto = require("../models/Producto");
const { Cliente, MovimientoInventario, Trabajador } = require("../models");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");
const AjustesService = require("./servicesAjustes");
const SucursalService = require("./servicesSucursal");

const ajustesService = new AjustesService();
const sucursalService = new SucursalService();
const operacionesEnProceso = new Set();
const operacionesProcesadas = new Map();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const buildOperacionKey = (tipo, dataVenta, detalles, id_caja) =>
  JSON.stringify({
    tipo,
    id_caja,
    total: toNumber(dataVenta?.total),
    id_cliente: dataVenta?.id_cliente,
    id_trabajador: dataVenta?.id_trabajador,
    id_sucursal: dataVenta?.id_sucursal,
    detalles: detalles.map((detalle) => ({
      id_producto: detalle.id_producto,
      id_lote: detalle.id_lote,
      cantidad: toNumber(detalle.cantidad),
      cantidad_unidad: toNumber(detalle.cantidad_unidad),
      precio: toNumber(detalle.precio),
    })),
  });

function decrementar(nombre, actual, delta = 0) {
  const nuevo = actual - delta;
  if (nuevo < 0) throw new Error(`${nombre} insuficiente`);
  return nuevo;
}

class servicesVenta {
  constructor() {
    this.sesion = {};
  }

  async obtenerIdSucursalOperacion(idSucursal, transaction) {
    if (idSucursal) return Number(idSucursal);
    const sucursalPrincipal = await sucursalService.obtenerSucursalPrincipal(
      transaction
    );
    return sucursalPrincipal.id_sucursal;
  }

  async realizarVentaCompleta(dataVenta, detalles, id_caja) {
    const operacionKey = buildOperacionKey(
      "venta-completa",
      dataVenta,
      detalles,
      id_caja
    );

    if (operacionesEnProceso.has(operacionKey)) {
      throw new Error("Esta venta ya se está procesando. Espere un momento.");
    }

    if (operacionesProcesadas.has(operacionKey)) {
      return operacionesProcesadas.get(operacionKey);
    }

    operacionesEnProceso.add(operacionKey);

    try {
    return await sequelize.transaction(async (t) => {
      const venta = await Venta.create(dataVenta, { transaction: t });

      await this.actualizarCajaYMovimientos(id_caja, dataVenta, t);

      await this.grabarDetallesYAjustarInventario(
        venta.id_venta,
        detalles,
        t,
        dataVenta?.id_sucursal
      );

      const clienteId = detalles[0].clienteId;
      await this.actualizarPuntosCliente(clienteId, t);

      operacionesProcesadas.set(operacionKey, venta);
      setTimeout(() => operacionesProcesadas.delete(operacionKey), 1000 * 60 * 10);

      return venta;
    });
    } finally {
      operacionesEnProceso.delete(operacionKey);
    }
  }

  async actualizarCajaYMovimientos(id_caja, dataVenta, transaction) {
    if (dataVenta.metodo_pago === "QR") {
      return;
    }

    const caja = await Caja.findByPk(id_caja, { transaction });
    if (!caja) throw new Error(`Caja ${id_caja} no encontrada`);

    const montoVenta = parseFloat(dataVenta.total);
    const nuevoMonto = parseFloat(caja.monto_final) + montoVenta;
    await caja.update({ monto_final: nuevoMonto }, { transaction });

    await MovimientoCaja.create(
      {
        id_caja,
        tipo_movimiento: "Ingreso",
        motivo: "Venta realizada",
        monto: montoVenta,
          fecha_movimiento: dataVenta.fecha_venta,
          id_trabajador: dataVenta.id_trabajador,
          id_sucursal: dataVenta.id_sucursal || null,
      },
      { transaction }
    );
  }

  async grabarDetallesYAjustarInventario(
    id_venta,
    detalles,
    transaction,
    idSucursal = null
  ) {
    const mods = {};
    const productosAfectados = new Set();
    const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
      idSucursal,
      transaction
    );

    for (const det of detalles) {
      const {
        id_producto,
        id_lote,
        cantidad,
        cantidad_unidad,
        peso,
        detalle,
        precio,
        clienteId,
      } = det;

      await DetalleVenta.create(
        {
          id_venta,
          id_producto,
          id_lote,
          cantidad,
          subCantidad: cantidad_unidad,
          peso,
          detalle,
          precio_unitario: precio,
        },
        { transaction }
      );

      const inv = await Inventario.findOne({
        where: { id_producto, id_lote, id_sucursal: idSucursalOperacion },
        transaction,
      });
      if (!inv) throw new Error("Inventario no encontrado para producto/lote");
      productosAfectados.add(id_producto);

      inv.subCantidad = decrementar(
        "subCantidad",
        inv.subCantidad,
        cantidad_unidad
      );
      inv.cantidad = decrementar("cantidad", inv.cantidad, cantidad);
      inv.peso = decrementar("peso", inv.peso, peso);
      await inv.update(
        {
          cantidad: inv.cantidad,
          subCantidad: inv.subCantidad,
          peso: inv.peso,
        },
        { transaction }
      );

      if (!mods[id_producto]) {
        const prod = await Producto.findByPk(id_producto, { transaction });
        if (!prod) throw new Error("Producto no encontrado");
        mods[id_producto] = {
          prod,
          stock: prod.stock,
          subCantidad: prod.subCantidad,
          peso: prod.peso,
        };
      }
      mods[id_producto].stock = decrementar(
        "stock",
        mods[id_producto].stock,
        cantidad
      );
      mods[id_producto].subCantidad = decrementar(
        "subCantidad",
        mods[id_producto].subCantidad,
        cantidad_unidad
      );
      mods[id_producto].peso = decrementar(
        "peso",
        mods[id_producto].peso,
        peso
      );
    }

    for (const { prod, stock, subCantidad, peso } of Object.values(mods)) {
      await prod.update({ stock, subCantidad, peso }, { transaction });
    }

    for (const id_producto of productosAfectados) {
      await ajustesService.sincronizarStockProducto(id_producto, transaction);
    }
  }

  async actualizarPuntosCliente(clienteId, transaction) {
    const cliente = await Cliente.findByPk(clienteId, { transaction });
    if (cliente) {
      const nuevos = cliente.puntos_fidelidad + 1;
      await cliente.update({ puntos_fidelidad: nuevos }, { transaction });
    }
  }

  async procesarInventario(dataVenta, detalles, id_caja) {
    const operacionKey = buildOperacionKey(
      "salida-inventario",
      dataVenta,
      detalles,
      id_caja
    );

    if (operacionesEnProceso.has(operacionKey)) {
      throw new Error(
        "Este movimiento de inventario ya se está procesando. Espere un momento."
      );
    }

    if (operacionesProcesadas.has(operacionKey)) {
      return operacionesProcesadas.get(operacionKey);
    }

    operacionesEnProceso.add(operacionKey);

    try {
    return await sequelize.transaction(async (t) => {
      const mods = {};
      const productosAfectados = new Set();
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        dataVenta?.id_sucursal,
        t
      );

      for (const det of detalles) {
        const { id_producto, id_lote, cantidad, cantidad_unidad, peso } = det;

        const inv = await Inventario.findOne({
          where: { id_producto, id_lote, id_sucursal: idSucursalOperacion },
          transaction: t,
        });
        if (!inv)
          throw new Error("Inventario no encontrado para producto/lote");
        productosAfectados.add(id_producto);

        inv.subCantidad = decrementar(
          "subCantidad",
          inv.subCantidad,
          cantidad_unidad
        );
        inv.cantidad = decrementar("cantidad", inv.cantidad, cantidad);
        inv.peso = decrementar("peso", inv.peso, peso);

        await inv.update(
          {
            cantidad: inv.cantidad,
            subCantidad: inv.subCantidad,
            peso: inv.peso,
          },
          { transaction: t }
        );

        await MovimientoInventario.create(
          {
            id_producto,
            fecha_movimiento: dataVenta.fecha_venta,
            tipo_movimiento: "Salida sin venta",
            cantidad: cantidad,
            subCantidad: cantidad_unidad,
            id_trabajador: dataVenta.id_trabajador,
            lote: id_lote,
            id_sucursal: idSucursalOperacion,
          },
          { transaction: t }
        );

        if (!mods[id_producto]) {
          const prod = await Producto.findByPk(id_producto, { transaction: t });
          if (!prod) throw new Error("Producto no encontrado");
          mods[id_producto] = {
            prod,
            stock: prod.stock,
            subCantidad: prod.subCantidad,
            peso: prod.peso,
          };
        }

        mods[id_producto].stock = decrementar(
          "stock",
          mods[id_producto].stock,
          cantidad
        );
        mods[id_producto].subCantidad = decrementar(
          "subCantidad",
          mods[id_producto].subCantidad,
          cantidad_unidad
        );
        mods[id_producto].peso = decrementar(
          "peso",
          mods[id_producto].peso,
          peso
        );
      }

      for (const { prod, stock, subCantidad, peso } of Object.values(mods)) {
        await prod.update({ stock, subCantidad, peso }, { transaction: t });
      }

      for (const id_producto of productosAfectados) {
        await ajustesService.sincronizarStockProducto(id_producto, t);
      }

      const resultado = { success: true };
      operacionesProcesadas.set(operacionKey, resultado);
      setTimeout(() => operacionesProcesadas.delete(operacionKey), 1000 * 60 * 10);

      return resultado;
    });
    } finally {
      operacionesEnProceso.delete(operacionKey);
    }
  }

  async anularVenta(ventaDetalles) {
    console.log("anulacion de venta:", ventaDetalles);

    return await sequelize.transaction(async (t) => {
      if (!ventaDetalles || ventaDetalles.length === 0) {
        throw new Error("No hay detalles para anular la venta");
      }

      const id_venta = ventaDetalles[0].id_venta;
      const id_caja = ventaDetalles[0].id_caja;
      const fecha_venta = ventaDetalles[0].fecha_venta;
      const id_trabajador = ventaDetalles[0].id_trabajador;
      const clienteId = ventaDetalles[0].clienteId;
      const total = ventaDetalles[0].total;
      const ventaOriginal = await Venta.findByPk(id_venta, { transaction: t });
      const metodoPagoOriginal =
        ventaDetalles[0].metodo_pago || ventaOriginal?.metodo_pago || "Contado";
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        ventaDetalles[0].id_sucursal,
        t
      );

      let totalVenta = 0;
      const mods = {};
      const productosAfectados = new Set();

      for (const det of ventaDetalles) {
        const {
          id_detalle,
          id_producto,
          id_lote,
          cantidad,
          cantidad_unidad,
          precio,
        } = det;

        // Eliminar el detalle
        await DetalleVenta.destroy({ where: { id_detalle }, transaction: t });

        // Restaurar inventario del lote
        const inv = await Inventario.findOne({
          where: { id_producto, id_lote, id_sucursal: idSucursalOperacion },
          transaction: t,
        });
        if (!inv)
          throw new Error("Inventario no encontrado para producto/lote");
        productosAfectados.add(id_producto);

        inv.subCantidad += cantidad_unidad;
        inv.cantidad += cantidad;
        await inv.update(
          {
            cantidad: inv.cantidad,
            subCantidad: inv.subCantidad,
          },
          { transaction: t }
        );

        // Acumular modificaciones para el producto
        if (!mods[id_producto]) {
          const prod = await Producto.findByPk(id_producto, { transaction: t });
          if (!prod) throw new Error("Producto no encontrado");
          mods[id_producto] = {
            prod,
            stock: prod.stock,
            subCantidad: prod.subCantidad,
          };
        }

        mods[id_producto].stock += cantidad;
        mods[id_producto].subCantidad += cantidad_unidad;

        // Sumar al total de la venta
        totalVenta += parseFloat(precio);
      }

      // Actualizar productos
      for (const { prod, stock, subCantidad } of Object.values(mods)) {
        await prod.update({ stock, subCantidad }, { transaction: t });
      }

      for (const id_producto of productosAfectados) {
        await ajustesService.sincronizarStockProducto(id_producto, t);
      }

      // Eliminar la venta
      await Venta.destroy({ where: { id_venta }, transaction: t });

      if (metodoPagoOriginal !== "QR") {
        // Actualizar caja y registrar movimiento
        const caja = await Caja.findByPk(id_caja, { transaction: t });
        if (!caja) throw new Error(`Caja ${id_caja} no encontrada`);
        const nuevoMonto = parseFloat(caja.monto_final) - parseFloat(total);
        await caja.update({ monto_final: nuevoMonto }, { transaction: t });

        await MovimientoCaja.create(
          {
            id_caja,
            tipo_movimiento: "Retiro",
            motivo: "Anulación de venta",
            monto: parseFloat(total),
            fecha_movimiento: fecha_venta,
            id_trabajador,
            id_sucursal: idSucursalOperacion,
          },
          { transaction: t }
        );
      }

      // Actualizar puntos del cliente
      const cliente = await Cliente.findByPk(clienteId, { transaction: t });
      if (cliente && cliente.puntos_fidelidad > 0) {
        await cliente.update(
          { puntos_fidelidad: cliente.puntos_fidelidad - 1 },
          { transaction: t }
        );
      }
    });
  }

  async getAllVentas(id_sucursal = null) {
    try {
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        id_sucursal
      );
      const ventas = await Venta.findAll({
        where: { id_sucursal: idSucursalOperacion },
      });
      return ventas;
    } catch (error) {
      console.error("Error fetching all ventas:", error);
      throw error;
    }
  }

  async getVentasDelDia(id_sucursal = null) {
    try {
      const idSucursalOperacion = await this.obtenerIdSucursalOperacion(
        id_sucursal
      );
      const fechaHoy = DateTime.now().setZone("America/La_Paz").startOf("day");
      const finDia = DateTime.now().setZone("America/La_Paz").endOf("day");

      const ventas = await Venta.findAll({
        where: {
          fecha_venta: {
            [Op.between]: [fechaHoy.toJSDate(), finDia.toJSDate()],
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
                attributes: ["nombre"],
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

  async createVenta(data) {
    try {
      const newVenta = await Venta.create(data);
      return newVenta;
    } catch (error) {
      console.error("Error creating venta:", error);
      throw error;
    }
  }

  async updateVenta(id_venta, data) {
    try {
      const venta = await Venta.findByPk(id_venta);
      if (!venta) {
        throw new Error(`Venta with ID ${id_venta} not found`);
      }
      await venta.update(data);
      return venta;
    } catch (error) {
      console.error("Error updating venta:", error);
      throw error;
    }
  }

  async deleteVenta(id_venta) {
    try {
      const venta = await Venta.findByPk(id_venta);
      if (!venta) {
        throw new Error(`Venta with ID ${id_venta} not found`);
      }
      await venta.destroy();
      return { message: "Venta deleted successfully" };
    } catch (error) {
      console.error("Error deleting venta:", error);
      throw error;
    }
  }
}

module.exports = servicesVenta;
