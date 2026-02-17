import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { loadPluginsFromEnv } from "@/runtime/plugin-loader";
import { mockPluginHooks, resetMockPluginHooks } from "../fixtures/test-plugin";
import { createApp, Text } from "@/index";

describe("Plugin System", () => {
  const originalEnv = process.env.BTUIN_PLUGINS;
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    resetMockPluginHooks();
    consoleErrorSpy.mockClear();
    process.env.BTUIN_PLUGINS = undefined;
  });

  afterEach(() => {
    process.env.BTUIN_PLUGINS = originalEnv;
  });

  describe("plugin-loader", () => {
    it("should return an empty array if env var is not set", async () => {
      const plugins = await loadPluginsFromEnv();
      expect(plugins).toEqual([]);
    });

    it("should log an error and return empty array for invalid JSON", async () => {
      process.env.BTUIN_PLUGINS = "invalid-json";
      const plugins = await loadPluginsFromEnv();
      expect(plugins).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[btuin] Failed to parse BTUIN_PLUGINS env var:",
        expect.any(Error),
      );
    });

    it("should load a single plugin from env var", async () => {
      const pluginOptions = { test: "value" };
      process.env.BTUIN_PLUGINS = JSON.stringify([
        {
          module: "tests/fixtures/test-plugin.ts",
          options: pluginOptions,
        },
      ]);

      const plugins = await loadPluginsFromEnv();
      expect(plugins).toHaveLength(1);
      const plugin = plugins[0] as any;
      expect(plugin.name).toBe("TestPlugin");
      expect(plugin.options).toEqual(pluginOptions);
    });

    it("should handle module not found error", async () => {
      process.env.BTUIN_PLUGINS = JSON.stringify([{ module: "non-existent-module.ts" }]);
      const plugins = await loadPluginsFromEnv();
      expect(plugins).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[btuin] Failed to load plugin from non-existent-module.ts:",
        expect.any(Error),
      );
    });
  });

  describe("LoopManager integration", () => {
    it("should call plugin hooks during the application lifecycle", async () => {
      process.env.BTUIN_PLUGINS = JSON.stringify([{ module: "tests/fixtures/test-plugin.ts" }]);

      const app = createApp({
        init: () => ({}),
        render: () => Text("Hello"),
      });

      // Mount the app, which will load and integrate the plugin
      await app.mount({ rows: 10, cols: 20 });

      // wrapView and onLayout are called on the first render
      expect(mockPluginHooks.wrapView).toHaveBeenCalled();
      expect(mockPluginHooks.onLayout).toHaveBeenCalled();

      // Test dispose
      expect(mockPluginHooks.dispose).not.toHaveBeenCalled();
      await app.unmount();
      expect(mockPluginHooks.dispose).toHaveBeenCalled();
    });

    it("should chain wrapView hooks from multiple plugins", async () => {
      // Setup two plugins
      const plugin1 = {
        name: "Plugin1",
        wrapView: vi.fn((root) => Text(`p1(${root.props.value})`)),
      };
      const plugin2 = {
        name: "Plugin2",
        wrapView: vi.fn((root) => Text(`p2(${root.props.value})`)),
      };

      // Mock the loader to return these plugins
      const loader = await import("@/runtime/plugin-loader");
      vi.spyOn(loader, "loadPluginsFromEnv").mockResolvedValue([plugin1, plugin2]);

      const app = createApp({
        init: () => ({}),
        render: () => Text("inner"),
      });

      // Need a way to inspect the final rendered view.
      // This test highlights the need for a test renderer or view traversal utility.
      // For now, we'll just check that the hooks were called.
      await app.mount({ rows: 10, cols: 20 });

      expect(plugin1.wrapView).toHaveBeenCalled();
      expect(plugin2.wrapView).toHaveBeenCalled();
      // In a more advanced test, we would assert:
      // expect(finalView.props.value).toBe("p2(p1(inner))");

      await app.unmount();
      vi.restoreAllMocks();
    });
  });
});
