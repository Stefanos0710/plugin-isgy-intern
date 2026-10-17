// Local test server: node dev-server.mjs  (needs MCP_SECRET, optional PORT and ISGY_BASE_URL)
import { createServer } from 'node:http';
import handler from './api/index.js';

process.env.MCP_SECRET ||= 'dev-secret-only-for-local-testing-0123456789';
const port = Number(process.env.PORT || 3000);
createServer((req, res) => handler(req, res)).listen(port, () => console.log(`ISGY MCP → http://localhost:${port}/mcp`));
