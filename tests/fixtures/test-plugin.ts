import { vi } from "bun:test";
import type { AppPlugin, AppPluginFactory } from "../../src/runtime/plugin";
import type { ViewElement } from "../../src/view/types/elements";

export const mockPluginHooks = {
  handleKey: vi.fn(),
  wrapView: vi.fn((root: ViewElement) => root),
  onLayout: vi.fn(),
  onProfileFrame: vi.fn(),
  dispose: vi.fn(),
};

export const resetMockPluginHooks = () => {
  mockPluginHooks.handleKey.mockClear();
  mockPluginHooks.wrapView.mockClear();
  mockPluginHooks.onLayout.mockClear();
  mockPluginHooks.onProfileFrame.mockClear();
  mockPluginHooks.dispose.mockClear();
  mockPluginHooks.wrapView.mockImplementation((root: ViewElement) => root);
};

const testPluginFactory: AppPluginFactory = (options?: any) => {
  const plugin: AppPlugin & { options?: any } = {
    name: "TestPlugin",
    ...mockPluginHooks,
  };
  if (options) {
    plugin.options = options;
  }
  return plugin;
};

export default testPluginFactory;
