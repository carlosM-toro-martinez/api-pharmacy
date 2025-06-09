const express = require("express");
const MovimientoCajaService = require("../services/servicesMovimientoCaja");
const route = express.Router();

const movimientoCajaService = new MovimientoCajaService();

// Ruta GET para obtener todos los movimientos de caja
route.get("/", async (req, res) => {
  try {
    const movimientos = await movimientoCajaService.getAllMovimientos();
    res.json(movimientos);
  } catch (error) {
    console.error("Error fetching movimientos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Ruta GET para obtener un movimiento por id_movimiento
route.get("/:id_movimiento", async (req, res) => {
  try {
    const { id_movimiento } = req.params;
    const movimiento = await movimientoCajaService.getMovimiento(id_movimiento);
    res.json(movimiento);
  } catch (error) {
    console.error("Error fetching movimiento:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta POST para crear un movimiento de caja
route.post("/", async (req, res) => {
  try {
    const {
      id_caja,
      tipo_movimiento,
      monto,
      id_trabajador,
      motivo,
      fecha_movimiento,
    } = req.body;

    if (
      !id_caja ||
      !tipo_movimiento ||
      !monto ||
      !id_trabajador ||
      !motivo ||
      !fecha_movimiento
    ) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    const movimiento = await movimientoCajaService.crearMovimientoCaja(
      id_caja,
      tipo_movimiento,
      monto,
      id_trabajador,
      motivo,
      fecha_movimiento
    );

    res.status(201).json(movimiento);
  } catch (error) {
    console.error("Error creating movimiento caja:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// // Ruta POST para crear un nuevo movimiento
// route.post("/", async (req, res) => {
//   try {
//     const newMovimiento = await movimientoCajaService.createMovimiento(
//       req.body
//     );
//     res.status(201).json(newMovimiento);
//   } catch (error) {
//     console.error("Error creating movimiento:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// Ruta PUT para actualizar un movimiento por id_movimiento
route.put("/:id_movimiento", async (req, res) => {
  try {
    const { id_movimiento } = req.params;
    const updatedMovimiento = await movimientoCajaService.updateMovimiento(
      id_movimiento,
      req.body
    );
    res.json(updatedMovimiento);
  } catch (error) {
    console.error("Error updating movimiento:", error);
    res.status(404).json({ error: error.message });
  }
});

// Ruta DELETE para eliminar un movimiento por id_movimiento
route.delete("/:id_movimiento", async (req, res) => {
  try {
    const { id_movimiento } = req.params;
    const message = await movimientoCajaService.deleteMovimiento(id_movimiento);
    res.json(message);
  } catch (error) {
    console.error("Error deleting movimiento:", error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = route;
