// Single-container launcher for Railway: payment API on loopback, merchant admin on the public $PORT.
// The admin server proxies /api/* to the payment API, so one public URL serves both.
const publicPort = Number(process.env.PORT || 8080);
const apiPort = 6100;
process.env.PAYMENT_API_PORT = String(apiPort);

const { startServer } = await import('../apps/payment-api/src/index.js');
const { startAdminServer } = await import('../apps/merchant-admin/src/index.js');

process.env.YOUPI_BIND_HOST = '127.0.0.1';
await startServer(apiPort);

process.env.YOUPI_BIND_HOST = '0.0.0.0';
await startAdminServer(publicPort);
