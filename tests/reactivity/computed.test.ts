import { describe, it, expect } from "bun:test";
import { computed, effect, ref } from "@/reactivity";

describe("computed", () => {
  it("should return an unwrapped value", () => {
    const a = ref(1);
    const b = computed(() => a.value + 1);
    expect(b.value).toBe(2);
  });

  it("should update when dependencies change", () => {
    const a = ref(1);
    const b = computed(() => a.value + 1);

    expect(b.value).toBe(2);
    a.value = 10;
    expect(b.value).toBe(11);
  });

  it("should be lazy and cache the result", () => {
    const a = ref(1);
    let getterCallCount = 0;
    const b = computed(() => {
      getterCallCount++;
      return a.value * 10;
    });

    // Accessing it the first time should call the getter
    expect(b.value).toBe(10);
    expect(getterCallCount).toBe(1);

    // Accessing it again without dependency change should not call the getter
    expect(b.value).toBe(10);
    expect(getterCallCount).toBe(1);

    // Changing the dependency should mark it as dirty, but not re-compute yet
    a.value = 2;
    expect(getterCallCount).toBe(1);

    // Accessing it again should now re-compute
    expect(b.value).toBe(20);
    expect(getterCallCount).toBe(2);
  });

  it("should work inside an effect", () => {
    const a = ref(1);
    const b = computed(() => a.value * 2);
    let result = 0;

    effect(() => {
      result = b.value;
    });

    expect(result).toBe(2);
    a.value = 5;
    expect(result).toBe(10);
  });

  it("should not break outer effect tracking when evaluating computed", () => {
    const a = ref(1);
    const b = computed(() => a.value * 2);
    const c = ref(0);
    let runs = 0;

    effect(() => {
      runs++;
      // Access computed first (nested effect), then a plain ref.
      // The plain ref must still be tracked by the outer effect.
      void b.value;
      void c.value;
    });

    expect(runs).toBe(1);
    c.value = 1;
    expect(runs).toBe(2);
  });

  it("should support writable computed properties", () => {
    const firstName = ref("John");
    const lastName = ref("Doe");

    const fullName = computed({
      get: () => `${firstName.value} ${lastName.value}`,
      set: (value) => {
        const parts = value.split(" ");
        firstName.value = parts[0]!;
        lastName.value = parts[1]!;
      },
    });

    expect(fullName.value).toBe("John Doe");

    fullName.value = "Jane Smith";

    expect(firstName.value).toBe("Jane");
    expect(lastName.value).toBe("Smith");
  });

  it("should not trigger effects if the value does not change", () => {
    const a = ref(1);
    const b = computed(() => (a.value > 5 ? "gt5" : "lte5"));
    let effectCallCount = 0;

    effect(() => {
      effectCallCount++;
      // just to subscribe
      // eslint-disable-next-line
      b.value;
    });

    expect(effectCallCount).toBe(1);

    a.value = 2; // b's value is still 'lte5'
    expect(effectCallCount).toBe(1);

    a.value = 6; // b's value changes to 'gt5'
    expect(effectCallCount).toBe(2);
  });
});
