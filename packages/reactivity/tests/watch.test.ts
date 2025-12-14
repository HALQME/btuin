import { describe, it, expect, mock } from "bun:test";
import { watch, watchEffect } from "../src/watch";
import { ref } from "../src/ref";
import { reactive } from "../src/reactive";

describe("watch", () => {
  it("should watch a single ref", () => {
    const a = ref(1);
    let newV: any, oldV: any;
    watch(a, (n, o) => {
      newV = n;
      oldV = o;
    });

    a.value = 2;
    expect(newV).toBe(2);
    expect(oldV).toBe(1);
  });

  it("should watch multiple sources", () => {
    const a = ref(1);
    const b = ref(2);
    let newV: any, oldV: any;

    watch([a, b], (n, o) => {
      newV = n;
      oldV = o;
    });

    a.value = 10;
    expect(newV).toEqual([10, 2]);
    expect(oldV).toEqual([1, 2]);

    b.value = 20;
    expect(newV).toEqual([10, 20]);
    expect(oldV).toEqual([10, 2]);
  });

  it("should watch a getter function", () => {
    const state = reactive({ a: 1, b: 2 });
    let newV: any, oldV: any;

    watch(
      () => state.a + state.b,
      (n, o) => {
        newV = n;
        oldV = o;
      },
    );

    state.a = 3;
    expect(newV).toBe(5);
    expect(oldV).toBe(3);
  });

  it("should support the immediate option", () => {
    const a = ref(1);
    let newV: any, oldV: any;
    watch(
      a,
      (n, o) => {
        newV = n;
        oldV = o;
      },
      { immediate: true },
    );

    expect(newV).toBe(1);
    expect(oldV).toBe(undefined);
  });

  it("should support deep watching", () => {
    const state = reactive({ nested: { count: 0 } });
    let newV: any, oldV: any;
    watch(
      () => state,
      (n, o) => {
        newV = n;
        oldV = o;
      },
      { deep: true },
    );

    state.nested.count = 1;
    expect(newV).toEqual({ nested: { count: 1 } });
    // Note: old value will be the same as new value for deep watch on objects
    expect(oldV).toEqual({ nested: { count: 1 } });
  });

  it("should call onCleanup", () => {
    const a = ref(1);
    let cleanedUp = false;
    const stop = watch(a, (n, o, onCleanup) => {
      onCleanup(() => {
        cleanedUp = true;
      });
    });

    a.value = 2; // This triggers the first cleanup
    expect(cleanedUp).toBe(true);

    cleanedUp = false;
    stop(); // This should trigger the second cleanup
    expect(cleanedUp).toBe(true);
  });
});

describe("watchEffect", () => {
  it("should run immediately and on dependency change", () => {
    const a = ref(1);
    let dummy = 0;
    watchEffect(() => {
      dummy = a.value;
    });

    expect(dummy).toBe(1);
    a.value = 2;
    expect(dummy).toBe(2);
  });

  it("should be stoppable", () => {
    const a = ref(1);
    let dummy = 0;
    const stop = watchEffect(() => {
      dummy = a.value;
    });

    expect(dummy).toBe(1);
    stop();
    a.value = 2;
    expect(dummy).toBe(1); // Should not update
  });

  it("should call onCleanup", () => {
    const a = ref(1);
    let cleanedUp = false;
    const stop = watchEffect((onCleanup) => {
      // eslint-disable-next-line
      a.value; // subscribe
      onCleanup(() => {
        cleanedUp = true;
      });
    });

    a.value = 2;
    expect(cleanedUp).toBe(true);

    cleanedUp = false;
    stop();
    expect(cleanedUp).toBe(true);
  });
});
