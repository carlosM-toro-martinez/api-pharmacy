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
} = require("../models");
const AjustesService = require("./servicesAjustes");

const ajustesService = new AjustesService();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

class servicesSucursal {
  async obtenerSucursalPrincipal(transaction = null) {
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
    const forwardedHost = req.headers["x-forwarded-host"];
    const host = forwardedHost || req.headers.host || req.hostname || "";
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

  async transferirInventario(data) {
    const idProducto = Number(data?.id_producto);
    const idLote = Number(data?.id_lote);
    const idSucursalOrigen = Number(data?.id_sucursal_origen);
    const idSucursalDestino = Number(data?.id_sucursal_destino);
    const cantidad = toNumber(data?.cantidad);
    const subCantidad = toNumber(data?.subCantidad);
    const peso = toNumber(data?.peso);
    const idTrabajador = data?.id_trabajador || null;

    if (!idProducto || !idLote || !idSucursalOrigen || !idSucursalDestino) {
      throw new Error(
        "Producto, lote, sucursal origen y sucursal destino son obligatorios."
      );
    }

    if (idSucursalOrigen === idSucursalDestino) {
      throw new Error("La sucursal origen y destino deben ser diferentes.");
    }

    if (cantidad <= 0 && subCantidad <= 0 && peso <= 0) {
      throw new Error("Debe transferir al menos cajas, unidades o peso.");
    }

    return await sequelize.transaction(async (transaction) => {
      const [producto, lote, sucursalOrigen, sucursalDestino] =
        await Promise.all([
          Producto.findByPk(idProducto, { transaction }),
          Lote.findByPk(idLote, { transaction }),
          Sucursal.findByPk(idSucursalOrigen, { transaction }),
          Sucursal.findByPk(idSucursalDestino, { transaction }),
        ]);

      if (!producto) throw new Error("Producto no encontrado.");
      if (!lote) throw new Error("Lote no encontrado.");
      if (!sucursalOrigen) throw new Error("Sucursal origen no encontrada.");
      if (!sucursalDestino) throw new Error("Sucursal destino no encontrada.");

      const inventarioOrigen = await Inventario.findOne({
        where: {
          id_producto: idProducto,
          id_lote: idLote,
          id_sucursal: idSucursalOrigen,
        },
        transaction,
        lock: true,
      });

      if (!inventarioOrigen) {
        throw new Error("No existe inventario del producto/lote en origen.");
      }

      if (
        toNumber(inventarioOrigen.cantidad) < cantidad ||
        toNumber(inventarioOrigen.subCantidad) < subCantidad ||
        toNumber(inventarioOrigen.peso) < peso
      ) {
        throw new Error("Stock insuficiente en la sucursal origen.");
      }

      inventarioOrigen.cantidad = toNumber(inventarioOrigen.cantidad) - cantidad;
      inventarioOrigen.subCantidad =
        toNumber(inventarioOrigen.subCantidad) - subCantidad;
      inventarioOrigen.peso = toNumber(inventarioOrigen.peso) - peso;
      inventarioOrigen.fecha_actualizacion = new Date();
      inventarioOrigen.id_trabajador = idTrabajador;
      await inventarioOrigen.save({ transaction });

      const [inventarioDestino] = await Inventario.findOrCreate({
        where: {
          id_producto: idProducto,
          id_lote: idLote,
          id_sucursal: idSucursalDestino,
        },
        defaults: {
          cantidad: 0,
          subCantidad: 0,
          peso: 0,
          fecha_actualizacion: new Date(),
          id_trabajador: idTrabajador,
        },
        transaction,
      });

      inventarioDestino.cantidad =
        toNumber(inventarioDestino.cantidad) + cantidad;
      inventarioDestino.subCantidad =
        toNumber(inventarioDestino.subCantidad) + subCantidad;
      inventarioDestino.peso = toNumber(inventarioDestino.peso) + peso;
      inventarioDestino.fecha_actualizacion = new Date();
      inventarioDestino.id_trabajador = idTrabajador;
      await inventarioDestino.save({ transaction });

      await MovimientoInventario.bulkCreate(
        [
          {
            id_producto: idProducto,
            fecha_movimiento: new Date(),
            tipo_movimiento: "Transferencia salida",
            cantidad,
            subCantidad,
            peso,
            id_trabajador: idTrabajador,
            lote: lote.numero_lote,
            id_sucursal: idSucursalOrigen,
            id_sucursal_destino: idSucursalDestino,
          },
          {
            id_producto: idProducto,
            fecha_movimiento: new Date(),
            tipo_movimiento: "Transferencia entrada",
            cantidad,
            subCantidad,
            peso,
            id_trabajador: idTrabajador,
            lote: lote.numero_lote,
            id_sucursal: idSucursalDestino,
            id_sucursal_destino: idSucursalOrigen,
          },
        ],
        { transaction }
      );

      await ajustesService.sincronizarStockProducto(idProducto, transaction);

      return {
        message: "Transferencia realizada correctamente.",
        producto: {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          codigo_barra: producto.codigo_barra,
        },
        lote: {
          id_lote: lote.id_lote,
          numero_lote: lote.numero_lote,
        },
        origen: {
          id_sucursal: sucursalOrigen.id_sucursal,
          nombre: sucursalOrigen.nombre,
          inventario: inventarioOrigen,
        },
        destino: {
          id_sucursal: sucursalDestino.id_sucursal,
          nombre: sucursalDestino.nombre,
          inventario: inventarioDestino,
        },
      };
    });
  }
}

module.exports = servicesSucursal;
