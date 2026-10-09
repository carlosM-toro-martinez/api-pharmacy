const { Op } = require("sequelize");
const {
  sequelize,
  Sucursal,
  Inventario,
  MovimientoInventario,
  Venta,
  Caja,
  MovimientoCaja,
  Producto,
  Lote,
  DetalleCompra,
  Trabajador,
} = require("../models");
const { getNowLapaz } = require("../utils/dateUtils");
const AjustesService = require("./servicesAjustes");
const ajustesService = new AjustesService();
const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// Mismo patron de servicesVenta.js: el boton de transferir/cargar stock
// solo se deshabilita DESPUES de que la mutacion empieza (hay un hueco
// async entre el clic y eso), asi que un doble clic o un reintento de red
// podian mandar la misma transferencia dos veces.
const operacionesEnProceso = new Set();
const operacionesProcesadas = new Map();
const VENTANA_DEDUP_MS = 5000;

const buildOperacionKey = (tipo, data) => JSON.stringify({ tipo, data });

class servicesSucursal {
  async obtenerSucursalPrincipal(transaction = null) {
    const marcadaPrincipal = await Sucursal.findOne({
      where: { es_principal: true, activo: true },
      order: [["id_sucursal", "ASC"]],
      transaction,
    });
    if (marcadaPrincipal) return marcadaPrincipal;

    const [sucursal] = await Sucursal.findOrCreate({
      where: { nombre: "Sucursal principal" },
      defaults: {
        direccion: "Principal",
        dominio: null,
        es_principal: true,
        activo: true,
      },
      transaction,
    });

    if (!sucursal.es_principal || !sucursal.activo) {
      await sucursal.update(
        { es_principal: true, activo: true },
        { transaction }
      );
    }

    return sucursal;
  }

  async inicializarSucursalPrincipal() {
    return await sequelize.transaction(async (transaction) => {
      const sucursal = await this.obtenerSucursalPrincipal(transaction);

      await Inventario.update(
        { id_sucursal: sucursal.id_sucursal },
        {
          where: {
            id_sucursal: {
              [Op.is]: null,
            },
          },
          transaction,
        }
      );

      await MovimientoInventario.update(
        { id_sucursal: sucursal.id_sucursal },
        {
          where: {
            id_sucursal: {
              [Op.is]: null,
            },
          },
          transaction,
        }
      );

      await Venta.update(
        { id_sucursal: sucursal.id_sucursal },
        {
          where: {
            id_sucursal: {
              [Op.is]: null,
            },
          },
          transaction,
        }
      );

      await Caja.update(
        { id_sucursal: sucursal.id_sucursal },
        {
          where: {
            id_sucursal: {
              [Op.is]: null,
            },
          },
          transaction,
        }
      );

      await MovimientoCaja.update(
        { id_sucursal: sucursal.id_sucursal },
        {
          where: {
            id_sucursal: {
              [Op.is]: null,
            },
          },
          transaction,
        }
      );

      return sucursal;
    });
  }

  async getAllSucursales() {
    return await Sucursal.findAll({
      order: [
        ["es_principal", "DESC"],
        ["nombre", "ASC"],
      ],
    });
  }

  async createSucursal(data) {
    const nombre = String(data?.nombre || "").trim();
    if (!nombre) {
      throw new Error("El nombre de la sucursal es obligatorio.");
    }

    return await Sucursal.create({
      nombre,
      direccion: data?.direccion || null,
      telefono: data?.telefono || null,
      dominio: this.normalizarDominio(data?.dominio),
      activo: data?.activo !== false,
      es_principal: false,
    });
  }

  normalizarDominio(dominio) {
    const value = String(dominio || "")
      .trim()
      .toLowerCase();
    return value || null;
  }

  obtenerDominioDesdeRequest(req) {
    const frontendHost = req.headers["x-frontend-host"];
    const forwardedHost = req.headers["x-forwarded-host"];
    const host =
      frontendHost || forwardedHost || req.headers.host || req.hostname || "";
    return String(host).split(",")[0].split(":")[0].trim().toLowerCase();
  }

  async resolverSucursalPorDominio(dominio, transaction = null) {
    const dominioNormalizado = this.normalizarDominio(dominio);
    if (!dominioNormalizado) return null;

    return await Sucursal.findOne({
      where: {
        dominio: dominioNormalizado,
        activo: true,
      },
      transaction,
    });
  }

  async resolverSucursalSesion({ req = null, trabajador = null } = {}) {
    const dominio = req ? this.obtenerDominioDesdeRequest(req) : null;
    const sucursalPorDominio = await this.resolverSucursalPorDominio(dominio);
    if (sucursalPorDominio) return sucursalPorDominio;

    if (trabajador?.id_sucursal) {
      const sucursalTrabajador = await Sucursal.findOne({
        where: {
          id_sucursal: trabajador.id_sucursal,
          activo: true,
        },
      });
      if (sucursalTrabajador) return sucursalTrabajador;
    }

    return await this.obtenerSucursalPrincipal();
  }

  async updateSucursal(id_sucursal, data) {
    const sucursal = await this.getSucursal(id_sucursal);
    const payload = {};

    if (data?.nombre !== undefined) {
      const nombre = String(data.nombre || "").trim();
      if (!nombre) throw new Error("El nombre de la sucursal es obligatorio.");
      payload.nombre = nombre;
    }
    if (data?.direccion !== undefined) payload.direccion = data.direccion || null;
    if (data?.telefono !== undefined) payload.telefono = data.telefono || null;
    if (data?.dominio !== undefined) {
      payload.dominio = this.normalizarDominio(data.dominio);
    }
    if (data?.activo !== undefined) payload.activo = Boolean(data.activo);

    await sucursal.update(payload);
    return sucursal;
  }

  async marcarPrincipal(id_sucursal) {
    return await sequelize.transaction(async (transaction) => {
      const sucursal = await this.getSucursal(id_sucursal);
      await Sucursal.update(
        { es_principal: false },
        { where: {}, transaction }
      );
      await sucursal.update(
        { es_principal: true, activo: true },
        { transaction }
      );
      return sucursal;
    });
  }

  async getSucursal(id_sucursal) {
    const sucursal = await Sucursal.findByPk(id_sucursal);
    if (!sucursal) {
      throw new Error(`Sucursal ${id_sucursal} no encontrada.`);
    }
    return sucursal;
  }

  async eliminarSucursal(id_sucursal) {
    const sucursal = await this.getSucursal(id_sucursal);

    const [
      inventario,
      movimientos,
      ventas,
      cajas,
      trabajadores,
    ] = await Promise.all([
      Inventario.count({ where: { id_sucursal } }),
      MovimientoInventario.count({
        where: {
          [Op.or]: [{ id_sucursal }, { id_sucursal_destino: id_sucursal }],
        },
      }),
      Venta.count({ where: { id_sucursal } }),
      Caja.count({ where: { id_sucursal } }),
      Trabajador.count({ where: { id_sucursal } }),
    ]);

    const usos = [];
    if (inventario > 0) usos.push(`${inventario} registro(s) de inventario`);
    if (movimientos > 0) usos.push(`${movimientos} movimiento(s)`);
    if (ventas > 0) usos.push(`${ventas} venta(s)`);
    if (cajas > 0) usos.push(`${cajas} caja(s)`);
    if (trabajadores > 0)
      usos.push(`${trabajadores} trabajador(es) asignado(s)`);

    if (usos.length > 0) {
      throw new Error(
        `No se puede eliminar "${sucursal.nombre}" porque todavia tiene datos: ${usos.join(
          ", "
        )}. Puedes desactivarla en su lugar.`
      );
    }

    await sucursal.destroy();
    return { message: `Sucursal "${sucursal.nombre}" eliminada correctamente.` };
  }

  // transaccionExterna: si se pasa (desde transferirInventarios, para que
  // una transferencia de varios productos sea atomica), se usa esa misma
  // transaccion en vez de abrir una propia, asi que un error en el
  // producto 2 revierte tambien lo que ya se habia hecho para el
  // producto 1 en esa misma llamada.
  async transferirInventario(data, transaccionExterna = null) {
    const idProducto = Number(data?.id_producto);
    const idSucursalOrigen = Number(data?.id_sucursal_origen);
    const idSucursalDestino = Number(data?.id_sucursal_destino);
    const subCantidad = toNumber(data?.subCantidad);
    const idTrabajador = data?.id_trabajador || null;

    // Overrides opcionales: si el usuario los indica en la transferencia,
    // reemplazan lo heredado del lote de origen para el/los lotes nuevos
    // que se crean en la sucursal destino.
    const overridePrecioVenta =
      data?.precioVenta !== undefined &&
      data?.precioVenta !== null &&
      data?.precioVenta !== ""
        ? toNumber(data.precioVenta)
        : null;
    const overridePrecioCompra =
      data?.precio_unitario !== undefined &&
      data?.precio_unitario !== null &&
      data?.precio_unitario !== ""
        ? toNumber(data.precio_unitario)
        : null;
    const overrideProveedor = data?.id_proveedor || null;
    const overrideFechaCaducidad = data?.fecha_caducidad || null;

    if (!idProducto || !idSucursalOrigen || !idSucursalDestino) {
      throw new Error(
        "Producto, sucursal origen y sucursal destino son obligatorios."
      );
    }

    if (idSucursalOrigen === idSucursalDestino) {
      throw new Error("La sucursal origen y destino deben ser diferentes.");
    }

    if (subCantidad <= 0) {
      throw new Error("La cantidad de unidades a transferir debe ser mayor a cero.");
    }

    const ejecutarTransferencia = async (transaction) => {
      const [producto, sucursalOrigen, sucursalDestino] =
        await Promise.all([
          Producto.findByPk(idProducto, { transaction }),
          Sucursal.findByPk(idSucursalOrigen, { transaction }),
          Sucursal.findByPk(idSucursalDestino, { transaction }),
        ]);

      if (!producto) throw new Error("Producto no encontrado.");
      if (!sucursalOrigen) throw new Error("Sucursal origen no encontrada.");
      if (!sucursalDestino) throw new Error("Sucursal destino no encontrada.");

      const inventariosOrigen = await Inventario.findAll({
        where: {
          id_producto: idProducto,
          id_sucursal: idSucursalOrigen,
          [Op.or]: [
            { subCantidad: { [Op.gt]: 0 } },
            { cantidad: { [Op.gt]: 0 } },
          ],
        },
        transaction,
        lock: true,
        order: [["id_inventario", "ASC"]],
      });

      const stockDisponible = inventariosOrigen.reduce(
        (total, inventario) =>
          total +
          (toNumber(inventario.subCantidad) > 0
            ? toNumber(inventario.subCantidad)
            : toNumber(inventario.cantidad)),
        0
      );
      if (stockDisponible < subCantidad) {
        throw new Error("Stock insuficiente en la sucursal origen.");
      }

      const idsLoteOrigen = [
        ...new Set(inventariosOrigen.map((i) => i.id_lote).filter(Boolean)),
      ];
      const lotesOrigen = idsLoteOrigen.length
        ? await Lote.findAll({
            where: { id_lote: idsLoteOrigen },
            transaction,
          })
        : [];
      const loteOrigenPorId = new Map(
        lotesOrigen.map((lote) => [lote.id_lote, lote])
      );

      const idsDetalleOrigen = [
        ...new Set(
          lotesOrigen.map((lote) => lote.id_detalle_compra).filter(Boolean)
        ),
      ];
      const detallesOrigen = idsDetalleOrigen.length
        ? await DetalleCompra.findAll({
            where: { id_detalle: idsDetalleOrigen },
            transaction,
          })
        : [];
      const detalleOrigenPorId = new Map(
        detallesOrigen.map((detalle) => [detalle.id_detalle, detalle])
      );

      let pendiente = subCantidad;
      for (const inventarioOrigen of inventariosOrigen) {
        if (pendiente <= 0) break;
        const unidadesOrigen =
          toNumber(inventarioOrigen.subCantidad) > 0
            ? toNumber(inventarioOrigen.subCantidad)
            : toNumber(inventarioOrigen.cantidad);
        const descontar = Math.min(pendiente, unidadesOrigen);
        if (toNumber(inventarioOrigen.subCantidad) > 0) {
          inventarioOrigen.subCantidad =
            toNumber(inventarioOrigen.subCantidad) - descontar;
        } else {
          inventarioOrigen.cantidad =
            toNumber(inventarioOrigen.cantidad) - descontar;
        }
        inventarioOrigen.fecha_actualizacion = getNowLapaz();
        inventarioOrigen.id_trabajador = idTrabajador;
        await inventarioOrigen.save({ transaction });
        pendiente -= descontar;

        const loteOrigen = loteOrigenPorId.get(inventarioOrigen.id_lote);
        const detalleOrigen = loteOrigen
          ? detalleOrigenPorId.get(loteOrigen.id_detalle_compra)
          : null;

        // Se crea un DetalleCompra propio (no se reutiliza el del origen) para
        // que borrar el lote transferido en destino nunca elimine el registro
        // de compra que la sucursal origen sigue usando. Si el usuario indicó
        // proveedor o precio de compra en la transferencia, esos reemplazan a
        // los heredados del origen.
        const idProveedorTransferencia =
          overrideProveedor ?? detalleOrigen?.id_proveedor ?? null;
        const precioCompraTransferencia =
          overridePrecioCompra ?? detalleOrigen?.precio_unitario ?? null;
        const detalleCompraTransferencia =
          detalleOrigen || idProveedorTransferencia || precioCompraTransferencia
            ? await DetalleCompra.create(
                {
                  id_proveedor: idProveedorTransferencia,
                  id_producto: idProducto,
                  cantidad: descontar,
                  subCantidad: descontar,
                  precio_unitario: precioCompraTransferencia,
                  peso: 0,
                  fecha_compra: getNowLapaz(),
                  id_trabajador: idTrabajador,
                },
                { transaction }
              )
            : null;

        const loteTransferencia = await Lote.create(
          {
            id_producto: idProducto,
            numero_lote: `TRANSFERENCIA-${idProducto}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            fecha_ingreso: getNowLapaz(),
            fecha_caducidad:
              overrideFechaCaducidad ?? loteOrigen?.fecha_caducidad ?? null,
            cantidad: descontar,
            subCantidad: descontar,
            peso: 0,
            cantidadPorCaja: 1,
            precioVenta:
              overridePrecioVenta ?? loteOrigen?.precioVenta ?? producto.precio,
            id_detalle_compra: detalleCompraTransferencia?.id_detalle ?? null,
          },
          { transaction }
        );

        await Inventario.create(
          {
            id_producto: idProducto,
            id_lote: loteTransferencia.id_lote,
            cantidad: descontar,
            subCantidad: descontar,
            peso: 0,
            fecha_actualizacion: getNowLapaz(),
            id_trabajador: idTrabajador,
            id_sucursal: idSucursalDestino,
          },
          { transaction }
        );
      }

      // Si el usuario indicó explícitamente el precio de venta en la
      // transferencia, se comparte con el resto de lotes del producto
      // (todas las sucursales), igual que al registrar una compra.
      if (overridePrecioVenta !== null) {
        await Lote.update(
          { precioVenta: overridePrecioVenta },
          { where: { id_producto: idProducto }, transaction }
        );
      }

      await ajustesService.sincronizarStockProducto(idProducto, transaction);

      await MovimientoInventario.bulkCreate(
        [
          {
            id_producto: idProducto,
            fecha_movimiento: getNowLapaz(),
            tipo_movimiento: "Transferencia salida",
            cantidad: 0,
            subCantidad,
            peso: 0,
            id_trabajador: idTrabajador,
            id_sucursal: idSucursalOrigen,
            id_sucursal_destino: idSucursalDestino,
          },
          {
            id_producto: idProducto,
            fecha_movimiento: getNowLapaz(),
            tipo_movimiento: "Transferencia entrada",
            cantidad: 0,
            subCantidad,
            peso: 0,
            id_trabajador: idTrabajador,
            id_sucursal: idSucursalDestino,
            id_sucursal_destino: idSucursalOrigen,
          },
        ],
        { transaction }
      );

      return {
        message: "Transferencia realizada correctamente.",
        producto: {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          codigo_barra: producto.codigo_barra,
        },
        origen: {
          id_sucursal: sucursalOrigen.id_sucursal,
          nombre: sucursalOrigen.nombre,
          unidades: subCantidad,
        },
        destino: {
          id_sucursal: sucursalDestino.id_sucursal,
          nombre: sucursalDestino.nombre,
          unidades: subCantidad,
        },
      };
    };

    if (transaccionExterna) {
      return await ejecutarTransferencia(transaccionExterna);
    }

    const operacionKey = buildOperacionKey("transferencia-simple", data);
    if (operacionesEnProceso.has(operacionKey)) {
      throw new Error("Esta transferencia ya se esta procesando. Espere un momento.");
    }
    if (operacionesProcesadas.has(operacionKey)) {
      console.error(
        `Transferencia duplicada detectada (misma transferencia repetida dentro de ${VENTANA_DEDUP_MS}ms): se devuelve el resultado anterior sin repetirla.`
      );
      return operacionesProcesadas.get(operacionKey);
    }
    operacionesEnProceso.add(operacionKey);
    try {
      const resultado = await sequelize.transaction(ejecutarTransferencia);
      operacionesProcesadas.set(operacionKey, resultado);
      setTimeout(() => operacionesProcesadas.delete(operacionKey), VENTANA_DEDUP_MS);
      return resultado;
    } finally {
      operacionesEnProceso.delete(operacionKey);
    }
  }

  // Una transferencia de varios productos se hace en UNA sola transaccion:
  // antes cada producto abria la suya propia, asi que si el producto 2 de
  // 3 fallaba (ej. stock insuficiente), el 1 ya habia quedado movido y el
  // 3 nunca se intentaba — una transferencia "a medias" sin que el usuario
  // se diera cuenta mas que por el mensaje de error.
  async transferirInventarios(data) {
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!items.length) {
      throw new Error("Debe agregar al menos un producto a la transferencia.");
    }

    const operacionKey = buildOperacionKey("transferencia-multiple", data);
    if (operacionesEnProceso.has(operacionKey)) {
      throw new Error("Esta transferencia ya se esta procesando. Espere un momento.");
    }
    if (operacionesProcesadas.has(operacionKey)) {
      console.error(
        `Transferencia multiple duplicada detectada (misma transferencia repetida dentro de ${VENTANA_DEDUP_MS}ms): se devuelve el resultado anterior sin repetirla.`
      );
      return operacionesProcesadas.get(operacionKey);
    }
    operacionesEnProceso.add(operacionKey);
    try {
      const resultado = await sequelize.transaction(async (transaction) => {
        const resultados = [];
        for (const item of items) {
          resultados.push(
            await this.transferirInventario(
              {
                ...item,
                id_sucursal_origen: data.id_sucursal_origen,
                id_sucursal_destino: data.id_sucursal_destino,
                id_trabajador: data.id_trabajador,
              },
              transaction
            )
          );
        }

        return {
          message: `${resultados.length} producto(s) transferido(s) correctamente.`,
          resultados,
        };
      });
      operacionesProcesadas.set(operacionKey, resultado);
      setTimeout(() => operacionesProcesadas.delete(operacionKey), VENTANA_DEDUP_MS);
      return resultado;
    } finally {
      operacionesEnProceso.delete(operacionKey);
    }
  }

  async cargarStockInicial(data) {
    const idSucursal = Number(data?.id_sucursal);
    const idTrabajador = data?.id_trabajador || null;
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!idSucursal) {
      throw new Error("La sucursal es obligatoria.");
    }

    const itemsValidos = items
      .map((item) => ({
        id_producto: Number(item?.id_producto),
        subCantidad: toNumber(item?.subCantidad),
        fecha_caducidad: item?.fecha_caducidad || null,
        precio_unitario:
          item?.precio_unitario !== undefined && item?.precio_unitario !== ""
            ? toNumber(item.precio_unitario)
            : null,
        id_proveedor: item?.id_proveedor || null,
        precio_venta:
          item?.precio_venta !== undefined && item?.precio_venta !== ""
            ? toNumber(item.precio_venta)
            : null,
      }))
      .filter((item) => item.id_producto && item.subCantidad > 0);

    if (!itemsValidos.length) {
      throw new Error("Debe indicar al menos una cantidad mayor a cero.");
    }

    const operacionKey = buildOperacionKey("stock-inicial", {
      idSucursal,
      idTrabajador,
      itemsValidos,
    });
    if (operacionesEnProceso.has(operacionKey)) {
      throw new Error("Esta carga de stock ya se esta procesando. Espere un momento.");
    }
    if (operacionesProcesadas.has(operacionKey)) {
      console.error(
        `Carga de stock inicial duplicada detectada (misma carga repetida dentro de ${VENTANA_DEDUP_MS}ms): se devuelve el resultado anterior sin repetirla.`
      );
      return operacionesProcesadas.get(operacionKey);
    }
    operacionesEnProceso.add(operacionKey);

    try {
      const resultado = await this.ejecutarCargaStockInicial(
        idSucursal,
        idTrabajador,
        itemsValidos
      );
      operacionesProcesadas.set(operacionKey, resultado);
      setTimeout(() => operacionesProcesadas.delete(operacionKey), VENTANA_DEDUP_MS);
      return resultado;
    } finally {
      operacionesEnProceso.delete(operacionKey);
    }
  }

  async ejecutarCargaStockInicial(idSucursal, idTrabajador, itemsValidos) {
    return await sequelize.transaction(async (transaction) => {
      const sucursal = await Sucursal.findByPk(idSucursal, { transaction });
      if (!sucursal) throw new Error("Sucursal no encontrada.");

      const idsProducto = itemsValidos.map((item) => item.id_producto);
      const productos = await Producto.findAll({
        where: { id_producto: idsProducto },
        transaction,
      });
      const productoPorId = new Map(
        productos.map((producto) => [producto.id_producto, producto])
      );

      // Se reutiliza el último precio de venta conocido del producto (en
      // cualquier sucursal) para no arrancar el stock nuevo con precio en 0.
      const lotesConPrecio = await Lote.findAll({
        where: {
          id_producto: idsProducto,
          precioVenta: { [Op.ne]: null },
        },
        order: [["id_lote", "DESC"]],
        transaction,
      });
      const precioVentaPorProducto = new Map();
      for (const lote of lotesConPrecio) {
        if (!precioVentaPorProducto.has(lote.id_producto)) {
          precioVentaPorProducto.set(lote.id_producto, lote.precioVenta);
        }
      }

      const resultados = [];
      for (const item of itemsValidos) {
        const producto = productoPorId.get(item.id_producto);
        if (!producto) continue;

        let detalleCompraInicial = null;
        if (item.precio_unitario !== null && item.id_proveedor) {
          detalleCompraInicial = await DetalleCompra.create(
            {
              id_proveedor: item.id_proveedor,
              id_producto: item.id_producto,
              cantidad: item.subCantidad,
              subCantidad: item.subCantidad,
              precio_unitario: item.precio_unitario,
              peso: 0,
              fecha_compra: getNowLapaz(),
              id_trabajador: idTrabajador,
            },
            { transaction }
          );
        }

        const loteInicial = await Lote.create(
          {
            id_producto: item.id_producto,
            numero_lote: `STOCK-INICIAL-${item.id_producto}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            fecha_ingreso: getNowLapaz(),
            fecha_caducidad: item.fecha_caducidad,
            cantidad: item.subCantidad,
            subCantidad: item.subCantidad,
            peso: 0,
            cantidadPorCaja: 1,
            precioVenta:
              item.precio_venta ??
              precioVentaPorProducto.get(item.id_producto) ??
              producto.precio ??
              null,
            id_detalle_compra: detalleCompraInicial?.id_detalle ?? null,
          },
          { transaction }
        );

        // Si el usuario indicó explícitamente el precio de venta, se comparte
        // con el resto de lotes del producto (todas las sucursales), igual
        // que al registrar una compra o editar un producto.
        if (item.precio_venta !== null) {
          await Lote.update(
            { precioVenta: item.precio_venta },
            { where: { id_producto: item.id_producto }, transaction }
          );
        }

        await Inventario.create(
          {
            id_producto: item.id_producto,
            id_lote: loteInicial.id_lote,
            cantidad: item.subCantidad,
            subCantidad: item.subCantidad,
            peso: 0,
            fecha_actualizacion: getNowLapaz(),
            id_trabajador: idTrabajador,
            id_sucursal: idSucursal,
          },
          { transaction }
        );

        resultados.push({
          id_producto: item.id_producto,
          nombre: producto.nombre,
          cantidad: item.subCantidad,
        });
      }

      if (!resultados.length) {
        throw new Error("Ninguno de los productos indicados existe.");
      }

      for (const idProducto of new Set(resultados.map((r) => r.id_producto))) {
        await ajustesService.sincronizarStockProducto(idProducto, transaction);
      }

      await MovimientoInventario.bulkCreate(
        resultados.map((resultado) => ({
          id_producto: resultado.id_producto,
          fecha_movimiento: getNowLapaz(),
          tipo_movimiento: "Carga de stock inicial",
          cantidad: 0,
          subCantidad: resultado.cantidad,
          peso: 0,
          id_trabajador: idTrabajador,
          id_sucursal: idSucursal,
        })),
        { transaction }
      );

      return {
        message: `${resultados.length} producto(s) cargado(s) correctamente.`,
        sucursal: { id_sucursal: sucursal.id_sucursal, nombre: sucursal.nombre },
        resultados,
      };
    });
  }
}

module.exports = servicesSucursal;
