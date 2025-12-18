import { describe, it, expect } from "bun:test";
import { customRef, effect, isRef, reactive, ref, shallowRef, toRef, toRefs, unref } from "@/reactivity";

describe("ref", () => {
  it("should hold a value", () => {
    const a = ref(1);
    expect(a.value).toBe(1);
    a.value = 2;
    expect(a.value).toBe(2);
  });

  it("should be reactive", () => {
    const a = ref(1);
    let dummy = 0;
    effect(() => {
      dummy = a.value;
    });
    expect(dummy).toBe(1);
    a.value = 2;
    expect(dummy).toBe(2);
  });

  it("should make nested properties reactive", () => {
    const a = ref({ count: 1 });
    let dummy = 0;
    effect(() => {
      dummy = a.value.count;
    });
    expect(dummy).toBe(1);
    a.value.count = 2;
    expect(dummy).toBe(2);
  });

  it("should not trigger if value is unchanged", () => {
    const a = ref(1);
    let callCount = 0;
    effect(() => {
      // eslint-disable-next-line
      a.value;
      callCount++;
    });
    expect(callCount).toBe(1);
    a.value = 1;
    expect(callCount).toBe(1);
  });
});

describe("isRef", () => {
  it("should return true for refs", () => {
    expect(isRef(ref(1))).toBe(true);
  });
  it("should return false for non-refs", () => {
    expect(isRef(1)).toBe(false);
    expect(isRef({ value: 1 })).toBe(false);
  });
});

describe("unref", () => {
  it("should return the inner value if it's a ref", () => {
    expect(unref(ref(1))).toBe(1);
  });
  it("should return the value itself if it's not a ref", () => {
    expect(unref(1)).toBe(1);
  });
});

describe("toRef", () => {
  it("should create a ref linked to a reactive object property", () => {
    const state = reactive({ foo: 1 });
    const fooRef = toRef(state, "foo");

    expect(isRef(fooRef)).toBe(true);
    expect(fooRef.value).toBe(1);

    // Update from ref -> state
    fooRef.value = 2;
    expect(state.foo).toBe(2);

    // Update from state -> ref
    state.foo = 3;
    expect(fooRef.value).toBe(3);
  });
});

describe("toRefs", () => {
  it("should convert a reactive object to an object of refs", () => {
    const state = reactive({ foo: 1, bar: 2 });
    const refs = toRefs(state);

    expect(isRef(refs.foo)).toBe(true);
    expect(isRef(refs.bar)).toBe(true);
    expect(refs.foo.value).toBe(1);

    state.foo = 2;
    expect(refs.foo.value).toBe(2);

    refs.bar.value = 3;
    expect(state.bar).toBe(3);
  });
});

describe("shallowRef", () => {
  it("should not make nested properties reactive", () => {
    const a = shallowRef({ count: 1 });
    let dummy = 0;
    effect(() => {
      dummy = a.value.count;
    });
    expect(dummy).toBe(1);

    // This should NOT trigger the effect
    a.value.count = 2;
    expect(dummy).toBe(1);

    // This SHOULD trigger the effect
    a.value = { count: 3 };
    expect(dummy).toBe(3);
  });
});

describe("customRef", () => {
  it("should create a custom ref with explicit tracking", (done) => {
    let value = 1;
    let timeout: any;
    const debouncedRef = customRef((track, trigger) => ({
      get() {
        track();
        return value;
      },
      set(newValue) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          value = newValue;
          trigger();
        }, 10);
      },
    }));

    let dummy = 0;
    effect(() => {
      dummy = debouncedRef.value;
    });

    expect(dummy).toBe(1);

    debouncedRef.value = 2;
    expect(dummy).toBe(1); // Not updated yet

    setTimeout(() => {
      expect(dummy).toBe(2);
      done();
    }, 20);
  });
});
