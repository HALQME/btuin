import { describe, it, expect } from "bun:test";
import {
  reactive,
  isReactive,
  toRaw,
  shallowReactive,
  ref,
  shallowRef,
  toRef,
  toRefs,
  customRef,
  computed,
  effect,
  stop,
  watch,
  watchEffect,
} from "../../src/reactivity";

describe("Reactivity internals", () => {
  it("tracks reactive objects and nested properties", () => {
    const state = reactive({ nested: { value: 0 } });
    let recorded = 0;

    const runner = effect(() => {
      recorded = state.nested.value;
    });

    expect(recorded).toBe(0);
    state.nested.value = 5;
    expect(recorded).toBe(5);
    expect(isReactive(state)).toBe(true);
    expect(toRaw(state).nested.value).toBe(5);

    stop(runner);
  });

  it("shallowReactive only tracks root mutations", () => {
    const state = shallowReactive({ nested: { value: 0 } });
    let runs = 0;

    const runner = effect(() => {
      runs += 1;
      state.nested.value;
    });

    expect(runs).toBe(1);
    state.nested.value = 1;
    expect(runs).toBe(1);
    state.nested = { value: 2 };
    expect(runs).toBe(2);

    stop(runner);
  });

  it("ref and shallowRef stay in sync and trigger effects appropriately", () => {
    const counter = ref(0);
    let refRead = 0;

    const runner = effect(() => {
      refRead = counter.value;
    });

    expect(refRead).toBe(0);
    counter.value = 3;
    expect(refRead).toBe(3);

    stop(runner);

    const shallow = shallowRef({ nested: 0 });
    let shallowRuns = 0;

    const shallowRunner = effect(() => {
      shallowRuns += 1;
      shallow.value.nested;
    });

    expect(shallowRuns).toBe(1);
    shallow.value.nested = 1;
    expect(shallowRuns).toBe(1);
    shallow.value = { nested: 2 };
    expect(shallowRuns).toBe(2);

    stop(shallowRunner);
  });

  it("toRef and toRefs keep reactive state linked", () => {
    const state = reactive({ name: "Alice" });
    const nameRef = toRef(state, "name");
    const { name } = toRefs(state);

    expect(nameRef.value).toBe("Alice");
    nameRef.value = "Bob";
    expect(state.name).toBe("Bob");
    name.value = "Carol";
    expect(state.name).toBe("Carol");
  });

  it("customRef honors manual tracking and triggering", () => {
    let internal = "initial";
    let readCalls = 0;

    const manual = customRef<string>((track, trigger) => ({
      get() {
        track();
        readCalls += 1;
        return internal;
      },
      set(value) {
        internal = value;
        trigger();
      },
    }));

    let seen = "";
    const runner = effect(() => {
      seen = manual.value;
    });

    expect(seen).toBe("initial");
    expect(readCalls).toBe(1);
    manual.value = "next";
    expect(seen).toBe("next");
    expect(readCalls).toBe(2);
    manual.value = "next";
    expect(readCalls).toBe(3);

    stop(runner);
  });

  it("computed caches results and honors setters", () => {
    const base = ref(1);
    let getterCalls = 0;

    const doubled = computed({
      get: () => {
        getterCalls += 1;
        return base.value * 2;
      },
      set(value) {
        base.value = value / 2;
      },
    });

    expect(doubled.value).toBe(2);
    expect(getterCalls).toBe(1);
    expect(doubled.value).toBe(2);
    expect(getterCalls).toBe(1);
    base.value = 3;
    expect(doubled.value).toBe(6);
    expect(getterCalls).toBe(2);
    expect(base.value).toBe(3);
  });

  it("watch calls callback with previous values and respects stop", () => {
    const counter = ref(0);
    const events: Array<[number, number | undefined]> = [];

    const stopHandle = watch(
      counter,
      (current, previous) => {
        events.push([current, previous]);
      },
      { immediate: true },
    );

    expect(events).toEqual([[0, undefined]]);
    events.length = 0;
    counter.value = 1;
    expect(events).toEqual([[1, 0]]);
    stopHandle();
    counter.value = 2;
    expect(events).toEqual([[1, 0]]);
  });

  it("watchEffect runs cleanup before each re-run", () => {
    const counter = ref(0);
    let cleanupCalls = 0;

    const stopHandle = watchEffect((onCleanup) => {
      onCleanup(() => {
        cleanupCalls += 1;
      });
      counter.value;
    });

    counter.value += 1;
    expect(cleanupCalls).toBe(1);
    const beforeStop = cleanupCalls;
    stopHandle();
    const afterStop = cleanupCalls;
    expect(afterStop).toBe(beforeStop + 1);
    counter.value += 1;
    expect(cleanupCalls).toBe(afterStop);
  });
});
