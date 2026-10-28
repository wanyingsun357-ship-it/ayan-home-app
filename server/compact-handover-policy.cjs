'use strict';
const timeoutMs = 900000;
function argumentsFor(args) {
 return [...args, '--fork-session', '--tools', 'Write', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--effort', 'low'];
}
module.exports = { timeoutMs, argumentsFor };
