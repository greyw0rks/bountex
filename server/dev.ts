import 'dotenv/config';
import { createServer } from 'node:http';
import { handler } from './handler.js';
const port = Number(process.env.API_PORT || 4174);
createServer((req, res) => {
  void handler(req, res);
}).listen(port, '127.0.0.1', () => console.log(`Bountex API: http://127.0.0.1:${port}`));
