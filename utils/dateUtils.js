const { DateTime } = require("luxon");

/**
 * Obtiene la fecha/hora actual en zona horaria La Paz (UTC-4)
 * @returns {Date} Objeto Date con la hora de La Paz
 */
const getNowLapaz = () => {
  return DateTime.now().setZone("America/La_Paz").toJSDate();
};

/**
 * Convierte una fecha a la zona horaria La Paz en formato ISO
 * @param {Date|string} date - Fecha a convertir
 * @returns {string} Fecha en formato ISO con zona horaria La Paz
 */
const toLapazISO = (date) => {
  return DateTime.fromJSDate(new Date(date))
    .setZone("America/La_Paz")
    .toISO();
};

/**
 * Convierte una fecha a la zona horaria La Paz en formato legible
 * @param {Date|string} date - Fecha a convertir
 * @param {string} format - Formato de Luxon (default: "dd/MM/yyyy HH:mm:ss")
 * @returns {string} Fecha formateada en zona horaria La Paz
 */
const formatLapaz = (date, format = "dd/MM/yyyy HH:mm:ss") => {
  return DateTime.fromJSDate(new Date(date))
    .setZone("America/La_Paz")
    .toFormat(format);
};

/**
 * Obtiene el inicio del día actual en La Paz
 * @returns {Date} Fecha del inicio del día en La Paz
 */
const startOfDayLapaz = () => {
  return DateTime.now()
    .setZone("America/La_Paz")
    .startOf("day")
    .toJSDate();
};

/**
 * Obtiene el fin del día actual en La Paz
 * @returns {Date} Fecha del fin del día en La Paz
 */
const endOfDayLapaz = () => {
  return DateTime.now()
    .setZone("America/La_Paz")
    .endOf("day")
    .toJSDate();
};

/**
 * Obtiene el inicio de un día específico en La Paz
 * @param {Date|string} date - Fecha a procesar
 * @returns {Date} Fecha del inicio del día en La Paz
 */
const startOfDayLapazFromDate = (date) => {
  return DateTime.fromJSDate(new Date(date))
    .setZone("America/La_Paz")
    .startOf("day")
    .toJSDate();
};

/**
 * Obtiene el fin de un día específico en La Paz
 * @param {Date|string} date - Fecha a procesar
 * @returns {Date} Fecha del fin del día en La Paz
 */
const endOfDayLapazFromDate = (date) => {
  return DateTime.fromJSDate(new Date(date))
    .setZone("America/La_Paz")
    .endOf("day")
    .toJSDate();
};

module.exports = {
  getNowLapaz,
  toLapazISO,
  formatLapaz,
  startOfDayLapaz,
  endOfDayLapaz,
  startOfDayLapazFromDate,
  endOfDayLapazFromDate,
};
