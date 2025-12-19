import { describe, it, expect } from "bun:test";
import {
  effect,
  reactive,
  stop,
  track,
  trigger,
  pauseTracking,
  resetTracking,
  type ReactiveEffect,
} from "@/reactivity";

describe("effect", () => {
  it("should run the passed function once", () => {
    let i = 0;
    effect(() => i++);
    expect(i).toBe(1);
  });

  it("should observe basic properties", () => {
    let dummy = 0;
    const counter = reactive({ num: 0 });
    effect(() => (dummy = counter.num));

    expect(dummy).toBe(0);
    counter.num = 7;
    expect(dummy).toBe(7);
  });

  it("should be able to be stopped", () => {
    let dummy = 0;
    const counter = reactive({ num: 0 });
    const runner = effect(() => (dummy = counter.num));

    expect(dummy).toBe(0);
    stop(runner);
    counter.num = 1;
    expect(dummy).toBe(0); // Should not update
  });

  it("should support a scheduler", () => {
    let dummy = 0;
    let run: ReactiveEffect | undefined;
    const scheduler = (eff: ReactiveEffect) => {
      run = eff;
    };
    const counter = reactive({ num: 0 });
    effect(() => (dummy = counter.num), { scheduler });

    expect(dummy).toBe(0);

    // It should not run immediately
    counter.num = 1;
    expect(dummy).toBe(0);

    // but the scheduler should have been called
    expect(run).toBeDefined();

    // Manually run the effect
    run!.run();
    expect(dummy).toBe(1);
  });

  it("should support lazy execution", () => {
    let i = 0;
    const counter = reactive({ num: 0 });
    effect(() => (i = counter.num), { lazy: true });

    expect(i).toBe(0); // Should not run on creation
    counter.num = 1;
    expect(i).toBe(1); // Should run on trigger
  });

  it("should call onStop when stopped", () => {
    let onStopCalled = false;
    const runner = effect(() => {}, {
      onStop: () => {
        onStopCalled = true;
      },
    });

    stop(runner);
    expect(onStopCalled).toBe(true);
  });
});

describe("track and trigger", () => {
  it("should track and trigger", () => {
    const obj = {};
    let dummy = 0;
    let eff: ReactiveEffect;

    eff = effect(() => {
      track(obj, "value");
      dummy++;
    });

    expect(dummy).toBe(1);
    trigger(obj, "value");
    expect(dummy).toBe(2);
  });
});

describe("tracking control", () => {
  it("should pause and reset tracking", () => {
    let dummy = 0;
    const counter = reactive({ num: 0 });

    effect(() => {
      pauseTracking();
      dummy = counter.num; // This access should not be tracked
      resetTracking();
    });

    expect(dummy).toBe(0);
    counter.num = 1;
    expect(dummy).toBe(0); // Effect should not re-run
  });
});
