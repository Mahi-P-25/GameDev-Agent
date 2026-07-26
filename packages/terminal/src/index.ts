export * from './TerminalTypes';
export * from './TerminalErrors';
export * from './TerminalEvents';
export * from './ProcessHandle';
export * from './CommandRunner';
export * from './ProcessManager';
export * from './TerminalClient';
export * from './TerminalToolAdapter';
// The browser-safe module is the default `terminalModule` so importing
// `@gamedev-agent/terminal` from the Studio UI never pulls in Node APIs.
export { browserTerminalModule, browserTerminalModule as terminalModule, TERMINAL_CLIENT_TOKEN } from './BrowserTerminalModule';
// The backend/Runtime module that actually spawns processes (Node only).
export { nodeTerminalModule } from './NodeTerminalModule';
