const fs = require("fs");
const path = require("path");
const util = require("util");
const { formatLapaz } = require("./dateUtils");

// Guarda cada error (console.error) en un archivo, ademas de la consola de
// siempre (docker logs). El archivo persiste entre despliegues porque la
// carpeta "logs" se monta como volumen (ver docker-compose/deploy.sh); sin
// eso, un redeploy borra el contenedor viejo y el archivo se perderia.
const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "errors.log");

const asegurarCarpeta = () => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    // Si ni siquiera se puede crear la carpeta, no tiene sentido seguir
    // intentando escribir en cada error; se deja constancia una sola vez
    // por consola (sin recursividad: no se usa console.error aca).
    process.stdout.write(`No se pudo crear la carpeta de logs: ${err.message}\n`);
  }
};

let activo = true;
asegurarCarpeta();

const formatearLinea = (args) => {
  const fecha = formatLapaz(new Date(), "dd/MM/yyyy HH:mm:ss");
  const mensaje = args
    .map((arg) => (typeof arg === "string" ? arg : util.inspect(arg, { depth: 4 })))
    .join(" ");
  return `[${fecha}] ${mensaje}\n`;
};

const instalarLoggerDeErrores = () => {
  const consoleErrorOriginal = console.error.bind(console);

  console.error = (...args) => {
    consoleErrorOriginal(...args);

    if (!activo) return;
    try {
      fs.appendFileSync(LOG_FILE, formatearLinea(args));
    } catch (err) {
      activo = false; // evita loguear el error de logueo en bucle
      consoleErrorOriginal("errorFileLogger: no se pudo escribir en el archivo de logs:", err.message);
    }
  };
};

module.exports = { instalarLoggerDeErrores, LOG_FILE };
