import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createComponentInstance,
  setCurrentInstance,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  onKey,
  onTick,
  invokeHooks,
  invokeKeyHooks,
  startTickTimers,
  stopTickTimers,
  unmountInstance,
  type ComponentInstance,
} from "@/view/components/lifecycle";

describe("Component Lifecycle", () => {
  let instance: ComponentInstance;

  beforeEach(() => {
    instance = createComponentInstance();
    setCurrentInstance(instance);
  });

  afterEach(() => {
    setCurrentInstance(null);
  });

  it("should create and manage component instances", () => {
    expect(instance).toBeDefined();
    expect(instance.uid).toBeGreaterThanOrEqual(0);
    expect(getCurrentInstance()).toBe(instance);
  });

  it("should register and invoke mounted hooks", () => {
    let mounted = false;
    onMounted(() => {
      mounted = true;
    });
    expect(instance.mountedHooks.length).toBe(1);
    invokeHooks(instance.mountedHooks);
    expect(mounted).toBe(true);
  });

  it("should register and invoke unmounted hooks", () => {
    let unmounted = false;
    onUnmounted(() => {
      unmounted = true;
    });
    expect(instance.unmountedHooks.length).toBe(1);
    invokeHooks(instance.unmountedHooks);
    expect(unmounted).toBe(true);
  });

  it("should register and invoke key hooks", () => {
    let keyEventHandled = false;
    onKey((event) => {
      if (event.name === "a") {
        keyEventHandled = true;
        return true; // stop propagation
      }
    });
    expect(instance.keyHooks.length).toBe(1);
    const handled = invokeKeyHooks(instance.keyHooks, {
      name: "a",
      sequence: "a",
      ctrl: false,
      meta: false,
      shift: false,
    });
    expect(keyEventHandled).toBe(true);
    expect(handled).toBe(true);
  });

  it("should manage tick hooks", async () => {
    let tickCount = 0;
    onTick(() => {
      tickCount++;
    }, 10); // 10ms interval for quick testing

    expect(instance.tickHooks.length).toBe(1);

    startTickTimers(instance);

    // Wait for a few ticks
    await new Promise((resolve) => setTimeout(resolve, 55));

    stopTickTimers(instance);

    // Should have ticked around 5 times
    expect(tickCount).toBeGreaterThanOrEqual(4);
    expect(tickCount).toBeLessThanOrEqual(6);

    // Ensure timer is stopped
    const lastCount = tickCount;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(tickCount).toBe(lastCount);
  });

  it("should unmount an instance and clean up", () => {
    let unmountedHookCalled = false;
    onUnmounted(() => {
      unmountedHookCalled = true;
    });

    let cleanupCalled = false;
    instance.effects.push(() => {
      cleanupCalled = true;
    });

    onTick(() => {}, 100);
    startTickTimers(instance);

    unmountInstance(instance);

    expect(instance.isMounted).toBe(false);
    expect(unmountedHookCalled).toBe(false);
    expect(cleanupCalled).toBe(true);
    expect(instance.tickHooks[0]?.timer).toBe(undefined);
  });
});
