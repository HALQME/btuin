import { describe, expect, test } from "bun:test";
import { computed, effect, ref } from "@/reactivity";

describe("@btuin/reactivity", () => {
  test("ref triggers effect", () => {
    const count = ref(0);
    let runs = 0;
    let last = -1;

    effect(() => {
      runs++;
      last = count.value;
    });

    expect(runs).toBe(1);
    expect(last).toBe(0);

    count.value = 1;
    expect(runs).toBe(2);
    expect(last).toBe(1);
  });

  test("computed updates", () => {
    const count = ref(2);
    const double = computed(() => count.value * 2);
    expect(double.value).toBe(4);
    count.value = 3;
    expect(double.value).toBe(6);
  });
});
