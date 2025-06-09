const express = require("express");
const routesAdmin = require("./routesAdmin");
const routesProduct = require("./routesProduct");
const routesRol = require("./routesRol");
const routesPermiso = require("./routesPermiso");
const routesRolPermiso = require("./routesRolPermiso");
const routesProveedor = require("./routesProveedor");
const routesClient = require("./routesClient");
const routesTrabajador = require("./routesTrabajador");
const routesDetalleCompra = require("./routesDetalleCompra");
const routesLote = require("./routesLote");
const routesInventario = require("./routesInventario");
const routesVenta = require("./routesVenta");
const routesDetalleVenta = require("./routesDetalleVenta");
const routesMovimientoInventario = require("./routesMovimientoInventario");
const routesCaja = require("./routesCaja");
const routesMovimientoCaja = require("./routesMovimientoCaja");
const routesReporte = require("./routesReporte");
const routesLogin = require("./routesLogin");
const routesCategoria = require("./routesCategoria");
const routesMetodoVenta = require("./routesMetodoVenta");

function router(app) {
  const routes = express.Router();
  app.use("/api/v1", routes);
  routes.use("/admins", routesAdmin);
  routes.use("/productos", routesProduct);
  routes.use("/rol", routesRol);
  routes.use("/permisos", routesPermiso);
  routes.use("/rol-permisos", routesRolPermiso);
  routes.use("/proveedores", routesProveedor);
  routes.use("/clientes", routesClient);
  routes.use("/trabajadores", routesTrabajador);
  routes.use("/detalle-compra", routesDetalleCompra);
  routes.use("/lote", routesLote);
  routes.use("/inventario", routesInventario);
  routes.use("/ventas", routesVenta);
  routes.use("/detalle-venta", routesDetalleVenta);
  routes.use("/movimiento-inventario", routesMovimientoInventario);
  routes.use("/caja", routesCaja);
  routes.use("/movimiento-caja", routesMovimientoCaja);
  routes.use("/reportes", routesReporte);
  routes.use("/categorias", routesCategoria);
  routes.use("/metodo-ventas", routesMetodoVenta);
  routes.use("/login", routesLogin);
}

module.exports = router;
