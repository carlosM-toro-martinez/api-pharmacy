// Simple script to send two POST requests almost simultaneously to reproduce duplicates
// Usage: node scripts/send_double_post.js http://localhost:3000/api/v1/ventas/venta-completa

const http = require('http');
const url = require('url');

function sendPost(targetUrl, payload, cb) {
  const parsed = url.parse(targetUrl);
  const options = {
    hostname: parsed.hostname || 'localhost',
    port: parsed.port || 3000,
    path: parsed.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => cb(null, res.statusCode, data));
  });

  req.on('error', (err) => cb(err));
  req.write(payload);
  req.end();
}

const target = process.argv[2] || 'http://localhost:3000/api/v1/ventas/venta-completa';
// Minimal valid-ish payload — adjust to your API shape
const payloadObj = {
  ventaData: { total: 1, fecha_venta: new Date().toISOString(), id_trabajador: 1 },
  detalles: [ { id_producto: 1, id_lote: 1, cantidad: 1, cantidad_unidad: 1, peso: 0, precio: 1, clienteId: 1 } ],
  id_caja: 1
};

const payload = JSON.stringify(payloadObj);

// Send two requests with tiny delay
sendPost(target, payload, (err, status, body) => {
  if (err) return console.error('First request error:', err);
  console.log('First - status:', status, 'body:', body);
});

setTimeout(() => {
  sendPost(target, payload, (err, status, body) => {
    if (err) return console.error('Second request error:', err);
    console.log('Second - status:', status, 'body:', body);
  });
}, 10); // 10 ms delay
