// vite.config.ts
import { fileURLToPath } from "node:url";
import react from "file:///C:/Users/hello/Documents/GameDev-Agent/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.20.1_lightningcss@1.32.0_/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/hello/Documents/GameDev-Agent/node_modules/.pnpm/@tailwindcss+vite@4.3.3_vite@5.4.21_@types+node@22.20.1_lightningcss@1.32.0_/node_modules/@tailwindcss/vite/dist/index.mjs";
import { defineConfig } from "file:///C:/Users/hello/Documents/GameDev-Agent/node_modules/.pnpm/vite@5.4.21_@types+node@22.20.1_lightningcss@1.32.0/node_modules/vite/dist/node/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/hello/Documents/GameDev-Agent/apps/studio/vite.config.ts";
var resolve = (path) => fileURLToPath(new URL(path, __vite_injected_original_import_meta_url));
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@gamedev-agent/shared": resolve("../../packages/shared/src/index.ts"),
      "@gamedev-agent/di": resolve("../../packages/di/src/index.ts"),
      "@gamedev-agent/config": resolve("../../packages/config/src/index.ts"),
      "@gamedev-agent/logging": resolve("../../packages/logging/src/index.ts"),
      "@gamedev-agent/events": resolve("../../packages/events/src/index.ts"),
      "@gamedev-agent/kernel": resolve("../../packages/kernel/src/index.ts"),
      "@gamedev-agent/project": resolve("../../packages/project/src/index.ts"),
      "@gamedev-agent/coordinator": resolve("../../packages/coordinator/src/index.ts"),
      "@gamedev-agent/producer": resolve("../../packages/producer/src/index.ts"),
      "@gamedev-agent/planner": resolve("../../packages/planner/src/index.ts"),
      "@gamedev-agent/capabilities": resolve("../../packages/capabilities/src/index.ts"),
      "@gamedev-agent/capabilities-stub": resolve(".verify_tmp/stub.ts"),
      "@gamedev-agent/tool-runtime": resolve("../../packages/tool-runtime/src/index.ts"),
      "@gamedev-agent/vscode": resolve("../../packages/vscode/src/index.ts"),
      "@gamedev-agent/terminal": resolve("../../packages/terminal/src/index.ts"),
      "@gamedev-agent/workflow": resolve("../../packages/workflow/src/index.ts"),
      "@gamedev-agent/intelligence": resolve("../../packages/intelligence/src/index.ts"),
      "@gamedev-agent/runtime": resolve("../../packages/runtime/src/index.ts"),
      "@gamedev-agent/agent-runtime": resolve("../../packages/agent-runtime/src/index.ts"),
      "@gamedev-agent/memory": resolve("../../packages/memory/src/index.ts"),
      "@gamedev-agent/execution-engine": resolve("../../packages/execution-engine/src/index.ts"),
      "@gamedev-agent/model-providers": resolve("../../packages/model-providers/src/index.ts"),
      "@gamedev-agent/studio-api": resolve("../../packages/studio-api/src/index.ts")
    }
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxoZWxsb1xcXFxEb2N1bWVudHNcXFxcR2FtZURldi1BZ2VudFxcXFxhcHBzXFxcXHN0dWRpb1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcaGVsbG9cXFxcRG9jdW1lbnRzXFxcXEdhbWVEZXYtQWdlbnRcXFxcYXBwc1xcXFxzdHVkaW9cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2hlbGxvL0RvY3VtZW50cy9HYW1lRGV2LUFnZW50L2FwcHMvc3R1ZGlvL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5cbmNvbnN0IHJlc29sdmUgPSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+IGZpbGVVUkxUb1BhdGgobmV3IFVSTChwYXRoLCBpbXBvcnQubWV0YS51cmwpKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIHRhaWx3aW5kY3NzKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9zaGFyZWQnOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy9zaGFyZWQvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvZGknOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy9kaS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9jb25maWcnOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy9jb25maWcvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvbG9nZ2luZyc6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL2xvZ2dpbmcvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvZXZlbnRzJzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvZXZlbnRzL3NyYy9pbmRleC50cycpLFxuICAgICAgJ0BnYW1lZGV2LWFnZW50L2tlcm5lbCc6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL2tlcm5lbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9wcm9qZWN0JzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvcHJvamVjdC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9jb29yZGluYXRvcic6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL2Nvb3JkaW5hdG9yL3NyYy9pbmRleC50cycpLFxuICAgICAgJ0BnYW1lZGV2LWFnZW50L3Byb2R1Y2VyJzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvcHJvZHVjZXIvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvcGxhbm5lcic6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL3BsYW5uZXIvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvY2FwYWJpbGl0aWVzJzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvY2FwYWJpbGl0aWVzL3NyYy9pbmRleC50cycpLFxuICAgICAgJ0BnYW1lZGV2LWFnZW50L2NhcGFiaWxpdGllcy1zdHViJzogcmVzb2x2ZSgnLnZlcmlmeV90bXAvc3R1Yi50cycpLFxuICAgICAgJ0BnYW1lZGV2LWFnZW50L3Rvb2wtcnVudGltZSc6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL3Rvb2wtcnVudGltZS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC92c2NvZGUnOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy92c2NvZGUvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvdGVybWluYWwnOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy90ZXJtaW5hbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC93b3JrZmxvdyc6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL3dvcmtmbG93L3NyYy9pbmRleC50cycpLFxuICAgICAgJ0BnYW1lZGV2LWFnZW50L2ludGVsbGlnZW5jZSc6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL2ludGVsbGlnZW5jZS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9ydW50aW1lJzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvcnVudGltZS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9hZ2VudC1ydW50aW1lJzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvYWdlbnQtcnVudGltZS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAZ2FtZWRldi1hZ2VudC9tZW1vcnknOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy9tZW1vcnkvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvZXhlY3V0aW9uLWVuZ2luZSc6IHJlc29sdmUoJy4uLy4uL3BhY2thZ2VzL2V4ZWN1dGlvbi1lbmdpbmUvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQGdhbWVkZXYtYWdlbnQvbW9kZWwtcHJvdmlkZXJzJzogcmVzb2x2ZSgnLi4vLi4vcGFja2FnZXMvbW9kZWwtcHJvdmlkZXJzL3NyYy9pbmRleC50cycpLFxuICAgICAgJ0BnYW1lZGV2LWFnZW50L3N0dWRpby1hcGknOiByZXNvbHZlKCcuLi8uLi9wYWNrYWdlcy9zdHVkaW8tYXBpL3NyYy9pbmRleC50cycpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBc1YsU0FBUyxxQkFBcUI7QUFDcFgsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsb0JBQW9CO0FBSDRMLElBQU0sMkNBQTJDO0FBSzFRLElBQU0sVUFBVSxDQUFDLFNBQXlCLGNBQWMsSUFBSSxJQUFJLE1BQU0sd0NBQWUsQ0FBQztBQUV0RixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLHlCQUF5QixRQUFRLG9DQUFvQztBQUFBLE1BQ3JFLHFCQUFxQixRQUFRLGdDQUFnQztBQUFBLE1BQzdELHlCQUF5QixRQUFRLG9DQUFvQztBQUFBLE1BQ3JFLDBCQUEwQixRQUFRLHFDQUFxQztBQUFBLE1BQ3ZFLHlCQUF5QixRQUFRLG9DQUFvQztBQUFBLE1BQ3JFLHlCQUF5QixRQUFRLG9DQUFvQztBQUFBLE1BQ3JFLDBCQUEwQixRQUFRLHFDQUFxQztBQUFBLE1BQ3ZFLDhCQUE4QixRQUFRLHlDQUF5QztBQUFBLE1BQy9FLDJCQUEyQixRQUFRLHNDQUFzQztBQUFBLE1BQ3pFLDBCQUEwQixRQUFRLHFDQUFxQztBQUFBLE1BQ3ZFLCtCQUErQixRQUFRLDBDQUEwQztBQUFBLE1BQ2pGLG9DQUFvQyxRQUFRLHFCQUFxQjtBQUFBLE1BQ2pFLCtCQUErQixRQUFRLDBDQUEwQztBQUFBLE1BQ2pGLHlCQUF5QixRQUFRLG9DQUFvQztBQUFBLE1BQ3JFLDJCQUEyQixRQUFRLHNDQUFzQztBQUFBLE1BQ3pFLDJCQUEyQixRQUFRLHNDQUFzQztBQUFBLE1BQ3pFLCtCQUErQixRQUFRLDBDQUEwQztBQUFBLE1BQ2pGLDBCQUEwQixRQUFRLHFDQUFxQztBQUFBLE1BQ3ZFLGdDQUFnQyxRQUFRLDJDQUEyQztBQUFBLE1BQ25GLHlCQUF5QixRQUFRLG9DQUFvQztBQUFBLE1BQ3JFLG1DQUFtQyxRQUFRLDhDQUE4QztBQUFBLE1BQ3pGLGtDQUFrQyxRQUFRLDZDQUE2QztBQUFBLE1BQ3ZGLDZCQUE2QixRQUFRLHdDQUF3QztBQUFBLElBQy9FO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxFQUNiO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
