import { CheckoutServer } from '../apps/checkout-portal/src/server.js';

const server = new CheckoutServer().createServer();

export default function handler(req, res) {
  server.emit('request', req, res);
}
