import type { AppPlugin, AppPluginFactory } from "./plugin";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

type PluginConfig = {
  module: string;
  options?: any;
};

function resolvePluginModule(spec: string): string {
  // Path is assumed to be relative to the project root (process.cwd())
  return pathToFileURL(resolve(process.cwd(), spec)).href;
}

export async function loadPluginsFromEnv(): Promise<AppPlugin[]> {
  const pluginsVar = process.env.BTUIN_PLUGINS;
  if (!pluginsVar) return [];

  let configs: PluginConfig[];
  try {
    configs = JSON.parse(pluginsVar);
    if (!Array.isArray(configs)) {
      console.error("[btuin] Failed to parse BTUIN_PLUGINS: not an array.");
      return [];
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[btuin] Failed to parse BTUIN_PLUGINS env var:", err);
    return [];
  }

  const loadedPlugins: AppPlugin[] = [];
  for (const config of configs) {
    try {
      const path = resolvePluginModule(config.module);
      const mod = await import(path);
      const factory = mod.default as AppPluginFactory;
      if (typeof factory !== "function") {
        console.error(`[btuin] Plugin ${config.module} does not have a default factory export.`);
        continue;
      }
      const plugin = await factory(config.options);
      loadedPlugins.push(plugin);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(`[btuin] Failed to load plugin from ${config.module}:`, err);
    }
  }

  return loadedPlugins;
}
