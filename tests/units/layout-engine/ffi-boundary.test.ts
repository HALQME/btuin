import { describe, it, expect } from "bun:test";
import { dlopen, FFIType, suffix } from "bun:ffi";
import path from "node:path";
import { existsSync } from "node:fs";

function resolveDevLibPath() {
  const libName = "liblayout_engine";
  return path.join(
    process.cwd(),
    "src",
    "layout-engine",
    "target",
    "release",
    `${libName}.${suffix}`,
  );
}

describe("Layout Engine FFI boundary", () => {
  it("should keep Rust and TS buffer layouts in sync", () => {
    const libPath = resolveDevLibPath();
    expect(existsSync(libPath)).toBe(true);

    const { symbols } = dlopen(libPath, {
      layout_engine_abi_version: { args: [], returns: FFIType.u32 },
      layout_engine_style_stride: { args: [], returns: FFIType.u32 },
      layout_engine_result_stride: { args: [], returns: FFIType.u32 },
      layout_engine_f32_size: { args: [], returns: FFIType.u32 },
      layout_engine_u32_size: { args: [], returns: FFIType.u32 },

      layout_engine_style_prop_flex_grow: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_flex_shrink: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_flex_direction: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_width: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_height: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_gap_row: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_gap_column: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_children_count: { args: [], returns: FFIType.u32 },
      layout_engine_style_prop_children_offset: { args: [], returns: FFIType.u32 },
    });

    const expectedAbiVersion = 1;

    const expectedStylePropIndex = {
      FlexDirection: 2,
      FlexGrow: 7,
      FlexShrink: 8,
      Width: 10,
      Height: 11,
      GapRow: 24,
      GapColumn: 25,
      ChildrenCount: 26,
      ChildrenOffset: 27,
      TotalProps: 28,
    } as const;

    const expectedResultStride = 5;

    expect(symbols.layout_engine_abi_version()).toBe(expectedAbiVersion);
    expect(symbols.layout_engine_style_stride()).toBe(expectedStylePropIndex.TotalProps);
    expect(symbols.layout_engine_result_stride()).toBe(expectedResultStride);
    expect(symbols.layout_engine_f32_size()).toBe(Float32Array.BYTES_PER_ELEMENT);
    expect(symbols.layout_engine_u32_size()).toBe(Uint32Array.BYTES_PER_ELEMENT);

    expect(symbols.layout_engine_style_prop_flex_direction()).toBe(
      expectedStylePropIndex.FlexDirection,
    );
    expect(symbols.layout_engine_style_prop_flex_grow()).toBe(expectedStylePropIndex.FlexGrow);
    expect(symbols.layout_engine_style_prop_flex_shrink()).toBe(expectedStylePropIndex.FlexShrink);
    expect(symbols.layout_engine_style_prop_width()).toBe(expectedStylePropIndex.Width);
    expect(symbols.layout_engine_style_prop_height()).toBe(expectedStylePropIndex.Height);
    expect(symbols.layout_engine_style_prop_gap_row()).toBe(expectedStylePropIndex.GapRow);
    expect(symbols.layout_engine_style_prop_gap_column()).toBe(expectedStylePropIndex.GapColumn);
    expect(symbols.layout_engine_style_prop_children_count()).toBe(
      expectedStylePropIndex.ChildrenCount,
    );
    expect(symbols.layout_engine_style_prop_children_offset()).toBe(
      expectedStylePropIndex.ChildrenOffset,
    );
  });
});

