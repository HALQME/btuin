const std = @import("std");
const Allocator = std.mem.Allocator;
const assert = std.debug.assert;

// ============================================================================
// Version and Constants
// ============================================================================

pub const VERSION_MAJOR: u32 = 3;
pub const VERSION_MINOR: u32 = 0;
pub const VERSION_PATCH: u32 = 0;

pub const ABI_VERSION: u32 = 3;
pub const STYLE_STRIDE: usize = 32;
pub const RESULT_STRIDE: usize = 5;
pub const MAX_BATCH_SIZE: usize = 16384;

// ============================================================================
// Error Codes
// ============================================================================

pub const ErrorCode = enum(i32) {
    Success = 0,
    NullPointer = -1,
    InvalidStride = -2,
    NoRoot = -3,
    NullNodesBuffer = -4,
    OutOfMemory = -6,
    TooManyNodes = -9,
};

// ============================================================================
// Style Property Indices
// ============================================================================

pub const StyleProp = enum(usize) {
    Display = 0,
    PositionType = 1,
    FlexDirection = 2,
    JustifyContent = 3,
    AlignItems = 4,
    AlignSelf = 5,
    FlexGrow = 6,
    FlexShrink = 7,
    Width = 8,
    Height = 9,
    MinWidth = 10,
    MinHeight = 11,
    MaxWidth = 12,
    MaxHeight = 13,
    GapRow = 14,
    GapColumn = 15,
    PaddingTop = 16,
    PaddingRight = 17,
    PaddingBottom = 18,
    PaddingLeft = 19,
    MarginTop = 20,
    MarginRight = 21,
    MarginBottom = 22,
    MarginLeft = 23,
    ChildrenCount = 24,
    ChildrenOffset = 25,
};

// ============================================================================
// Enums
// ============================================================================

pub const Display = enum(u8) { Flex = 0, None = 1 };
pub const PositionType = enum(u8) { Relative = 0, Absolute = 1 };
pub const FlexDirection = enum(u8) { Row = 0, Column = 1, RowReverse = 2, ColumnReverse = 3 };
pub const JustifyContent = enum(u8) { FlexStart = 0, FlexEnd = 1, Center = 2, SpaceBetween = 3, SpaceAround = 4, SpaceEvenly = 5 };
pub const AlignItems = enum(u8) { Stretch = 0, FlexStart = 1, FlexEnd = 2, Center = 3 };
pub const AlignSelf = enum(u8) { Auto = 0, FlexStart = 1, FlexEnd = 2, Center = 3, Stretch = 4 };

// ============================================================================
// Types
// ============================================================================

pub const Layout = extern struct {
    x: f32,
    y: f32,
    width: f32,
    height: f32,

    pub fn zero() Layout {
        return .{ .x = 0, .y = 0, .width = 0, .height = 0 };
    }
};

pub const ComputedStyle = struct {
    display: Display,
    position_type: PositionType,
    flex_direction: FlexDirection,
    justify_content: JustifyContent,
    align_items: AlignItems,
    align_self: AlignSelf,
    flex_grow: f32,
    flex_shrink: f32,
    gap_row: f32,
    gap_column: f32,
    padding_top: f32,
    padding_right: f32,
    padding_bottom: f32,
    padding_left: f32,
};

pub const Node = struct {
    id: u32,
    parent: ?u32,
    child_indices: []const u32,
    style: ComputedStyle,
    resolved_width: f32,
    resolved_height: f32,
    resolved_min_width: f32,
    resolved_min_height: f32,
    resolved_max_width: f32,
    resolved_max_height: f32,
    margin_top: f32,
    margin_right: f32,
    margin_bottom: f32,
    margin_left: f32,
    layout: Layout,
};

pub const LayoutContext = struct {
    allocator: Allocator,
    nodes: []Node,
    results: []f32,
    result_capacity: usize,
    temp_buffer: []f32,

    pub fn init(allocator: Allocator, max_nodes: usize) !LayoutContext {
        const nodes = try allocator.alloc(Node, max_nodes);
        const results = try allocator.alloc(f32, max_nodes * RESULT_STRIDE);
        const temp_buffer = try allocator.alloc(f32, max_nodes);

        return .{
            .allocator = allocator,
            .nodes = nodes,
            .results = results,
            .result_capacity = max_nodes * RESULT_STRIDE,
            .temp_buffer = temp_buffer,
        };
    }

    pub fn deinit(self: *LayoutContext) void {
        self.allocator.free(self.nodes);
        self.allocator.free(self.results);
        self.allocator.free(self.temp_buffer);
    }
};

pub const LayoutEngine = struct {
    allocator: Allocator,
    ctx: LayoutContext,

    pub fn init(allocator: Allocator) !LayoutEngine {
        const ctx = try LayoutContext.init(allocator, MAX_BATCH_SIZE);
        return .{
            .allocator = allocator,
            .ctx = ctx,
        };
    }

    pub fn deinit(self: *LayoutEngine) void {
        self.ctx.deinit();
    }
};

// ============================================================================
// Style Parsing
// ============================================================================

inline fn parseDimension(value: f32, parent_size: f32) f32 {
    if (std.math.isNan(value)) return 0;
    if (value < 0) return parent_size * (-value);
    return value;
}

pub inline fn parseStyle(style_buffer: []const f32, offset: usize) ComputedStyle {
    const base = offset * STYLE_STRIDE;

    return .{
        .display = @enumFromInt(@as(u8, @intFromFloat(style_buffer[base]))),
        .position_type = @enumFromInt(@as(u8, @intFromFloat(style_buffer[base + 1]))),
        .flex_direction = @enumFromInt(@as(u8, @intFromFloat(style_buffer[base + 2]))),
        .justify_content = @enumFromInt(@as(u8, @intFromFloat(style_buffer[base + 3]))),
        .align_items = @enumFromInt(@as(u8, @intFromFloat(style_buffer[base + 4]))),
        .align_self = @enumFromInt(@as(u8, @intFromFloat(style_buffer[base + 5]))),
        .flex_grow = style_buffer[base + 6],
        .flex_shrink = style_buffer[base + 7],
        .gap_row = style_buffer[base + 14],
        .gap_column = style_buffer[base + 15],
        .padding_top = style_buffer[base + 16],
        .padding_right = style_buffer[base + 17],
        .padding_bottom = style_buffer[base + 18],
        .padding_left = style_buffer[base + 19],
    };
}

pub inline fn parseDimensions(style_buffer: []const f32, offset: usize, parent_width: f32, parent_height: f32) struct {
    width: f32,
    height: f32,
    min_width: f32,
    min_height: f32,
    max_width: f32,
    max_height: f32,
    margin_top: f32,
    margin_right: f32,
    margin_bottom: f32,
    margin_left: f32,
} {
    const base = offset * STYLE_STRIDE;

    return .{
        .width = parseDimension(style_buffer[base + 8], parent_width),
        .height = parseDimension(style_buffer[base + 9], parent_height),
        .min_width = parseDimension(style_buffer[base + 10], parent_width),
        .min_height = parseDimension(style_buffer[base + 11], parent_height),
        .max_width = parseDimension(style_buffer[base + 12], parent_width),
        .max_height = parseDimension(style_buffer[base + 13], parent_height),
        .margin_top = style_buffer[base + 20],
        .margin_right = style_buffer[base + 21],
        .margin_bottom = style_buffer[base + 22],
        .margin_left = style_buffer[base + 23],
    };
}

// ============================================================================
// Layout Computation
// ============================================================================

inline fn applyConstraints(size: f32, min: f32, max: f32) f32 {
    var result = size;
    if (min > 0) result = @max(result, min);
    if (max > 0) result = @min(result, max);
    return @max(0, result);
}

pub fn computeNodeLayout(nodes: []Node, node_idx: usize, x: f32, y: f32, temp_buffer: []f32) void {
    const node = &nodes[node_idx];
    const style = node.style;

    const width = applyConstraints(node.resolved_width, node.resolved_min_width, node.resolved_max_width);
    const height = applyConstraints(node.resolved_height, node.resolved_min_height, node.resolved_max_height);

    node.layout = .{
        .x = x + node.margin_left,
        .y = y + node.margin_top,
        .width = @max(0, width - node.margin_left - node.margin_right),
        .height = @max(0, height - node.margin_top - node.margin_bottom),
    };

    if (node.child_indices.len == 0) return;

    const inner_width = @max(0, node.layout.width - style.padding_left - style.padding_right);
    const inner_height = @max(0, node.layout.height - style.padding_top - style.padding_bottom);

    layoutChildren(nodes, node, node.layout.x + style.padding_left, node.layout.y + style.padding_top, inner_width, inner_height, temp_buffer);
}

fn layoutChildren(nodes: []Node, parent: *Node, x: f32, y: f32, available_width: f32, available_height: f32, temp_buffer: []f32) void {
    const style = parent.style;
    const num_children = parent.child_indices.len;
    if (num_children == 0) return;

    const is_row = style.flex_direction == .Row or style.flex_direction == .RowReverse;
    const is_reverse = style.flex_direction == .RowReverse or style.flex_direction == .ColumnReverse;

    const gap = if (is_row) style.gap_column else style.gap_row;
    const total_gap = gap * @as(f32, @floatFromInt(num_children -| 1));
    const available_main = if (is_row) available_width else available_height;
    const cross_size = if (is_row) available_height else available_width;

    var total_flex_grow: f32 = 0;
    var total_base_size: f32 = 0;

    var i: usize = 0;
    while (i < num_children) : (i += 1) {
        const child_idx = parent.child_indices[i];
        const child = &nodes[child_idx];
        const base_size = if (is_row) child.resolved_width else child.resolved_height;

        total_flex_grow += child.style.flex_grow;
        total_base_size += base_size;
        temp_buffer[i] = base_size;
    }

    const remaining = available_main - total_base_size - total_gap;
    if (remaining > 0 and total_flex_grow > 0) {
        const grow_unit = remaining / total_flex_grow;
        i = 0;
        while (i < num_children) : (i += 1) {
            const child_idx = parent.child_indices[i];
            const child = &nodes[child_idx];
            if (child.style.flex_grow > 0) {
                temp_buffer[i] += grow_unit * child.style.flex_grow;
            }
        }
    }

    var current_pos: f32 = switch (style.justify_content) {
        .FlexStart => 0,
        .FlexEnd => available_main - total_base_size - total_gap,
        .Center => (available_main - total_base_size - total_gap) / 2,
        else => 0,
    };

    i = 0;
    while (i < num_children) : (i += 1) {
        const idx = if (is_reverse) num_children - 1 - i else i;
        const child_idx = parent.child_indices[idx];
        const child = &nodes[child_idx];

        const child_main = temp_buffer[idx];
        const child_cross = if (is_row) child.resolved_height else child.resolved_width;

        var cross_pos: f32 = 0;
        const effective_align = if (child.style.align_self != .Auto)
            @intFromEnum(child.style.align_self) - 1
        else
            @intFromEnum(style.align_items);

        switch (effective_align) {
            0 => cross_pos = 0,
            1 => cross_pos = cross_size - child_cross,
            2 => cross_pos = (cross_size - child_cross) / 2,
            else => {},
        }

        const is_stretch = (child.style.align_self == .Stretch or (child.style.align_self == .Auto and style.align_items == .Stretch));

        const child_x = if (is_row) x + current_pos else x + cross_pos;
        const child_y = if (is_row) y + cross_pos else y + current_pos;
        const child_width = if (is_row) child_main else if (is_stretch) cross_size else child_cross;
        const child_height = if (is_row) if (is_stretch) cross_size else child_cross else child_main;

        // Update child's resolved dimensions before computing its layout
        child.resolved_width = child_width;
        child.resolved_height = child_height;
        computeNodeLayout(nodes, child_idx, child_x, child_y, temp_buffer);

        current_pos += child_main + gap;

        switch (style.justify_content) {
            .SpaceBetween => if (i < num_children - 1) {
                current_pos += @max(0, (available_main - total_base_size - total_gap) / @as(f32, @floatFromInt(num_children - 1)));
            },
            .SpaceAround => current_pos += (available_main - total_base_size - total_gap) / @as(f32, @floatFromInt(num_children)),
            .SpaceEvenly => current_pos += (available_main - total_base_size - total_gap) / @as(f32, @floatFromInt(num_children + 1)),
            else => {},
        }
    }
}

fn buildResults(nodes: []const Node, results: []f32) void {
    var i: usize = 0;
    while (i < nodes.len) : (i += 1) {
        const base = i * RESULT_STRIDE;
        const node = nodes[i];
        results[base] = @floatFromInt(node.id);
        results[base + 1] = node.layout.x;
        results[base + 2] = node.layout.y;
        results[base + 3] = node.layout.width;
        results[base + 4] = node.layout.height;
    }
}

// ============================================================================
// FFI Exports
// ============================================================================

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

export fn le_create() ?*LayoutEngine {
    const engine = gpa.allocator().create(LayoutEngine) catch return null;
    engine.* = LayoutEngine.init(gpa.allocator()) catch return null;
    return engine;
}

export fn le_destroy(engine_ptr: ?*LayoutEngine) void {
    if (engine_ptr) |engine| {
        engine.deinit();
        gpa.allocator().destroy(engine);
    }
}

export fn le_version() u32 {
    return ABI_VERSION;
}

export fn le_compute(
    engine_ptr: ?*LayoutEngine,
    style_buffer_ptr: ?[*]const f32,
    style_buffer_len: usize,
    children_buffer_ptr: ?[*]const u32,
    children_buffer_len: usize,
    node_count: u32,
    available_width: f32,
    available_height: f32,
) i32 {
    const engine = engine_ptr orelse return @intFromEnum(ErrorCode.NullPointer);
    const style_buffer = style_buffer_ptr orelse return @intFromEnum(ErrorCode.NullNodesBuffer);

    if (style_buffer_len < node_count * STYLE_STRIDE) return @intFromEnum(ErrorCode.InvalidStride);
    if (node_count == 0) return @intFromEnum(ErrorCode.NoRoot);
    if (node_count > MAX_BATCH_SIZE) return @intFromEnum(ErrorCode.TooManyNodes);

    const ctx = &engine.ctx;
    const nodes = ctx.nodes[0..node_count];
    const style_slice = style_buffer[0..style_buffer_len];
    const children_buffer = if (children_buffer_len == 0) &[_]u32{} else children_buffer_ptr.?[0..children_buffer_len];

    var i: u32 = 0;
    while (i < node_count) : (i += 1) {
        const dims = parseDimensions(style_slice, i, available_width, available_height);
        const children_count = @as(u32, @intFromFloat(style_slice[i * STYLE_STRIDE + @intFromEnum(StyleProp.ChildrenCount)]));
        const children_start = @as(u32, @intFromFloat(style_slice[i * STYLE_STRIDE + @intFromEnum(StyleProp.ChildrenOffset)]));

        const child_indices = if (children_count > 0 and children_start + children_count <= children_buffer_len)
            children_buffer[children_start .. children_start + children_count]
        else
            &[_]u32{};

        nodes[i] = .{
            .id = i,
            .parent = if (i == 0) null else 0,
            .child_indices = child_indices,
            .style = parseStyle(style_slice, i),
            .resolved_width = dims.width,
            .resolved_height = dims.height,
            .resolved_min_width = dims.min_width,
            .resolved_min_height = dims.min_height,
            .resolved_max_width = dims.max_width,
            .resolved_max_height = dims.max_height,
            .margin_top = dims.margin_top,
            .margin_right = dims.margin_right,
            .margin_bottom = dims.margin_bottom,
            .margin_left = dims.margin_left,
            .layout = Layout.zero(),
        };
    }

    computeNodeLayout(nodes, 0, 0, 0, ctx.temp_buffer);
    buildResults(nodes, ctx.results[0..(node_count * RESULT_STRIDE)]);

    return @intFromEnum(ErrorCode.Success);
}

export fn le_get_results_ptr(engine_ptr: ?*LayoutEngine) ?[*]const f32 {
    const engine = engine_ptr orelse return null;
    return engine.ctx.results.ptr;
}

export fn le_get_results_len(engine_ptr: ?*LayoutEngine) usize {
    const engine = engine_ptr orelse return 0;
    return engine.ctx.result_capacity;
}

export fn le_abi_version() u32 {
    return ABI_VERSION;
}
export fn le_style_stride() u32 {
    return STYLE_STRIDE;
}
export fn le_result_stride() u32 {
    return RESULT_STRIDE;
}
export fn le_max_batch_size() u32 {
    return MAX_BATCH_SIZE;
}
export fn le_f32_size() u32 {
    return @sizeOf(f32);
}
export fn le_u32_size() u32 {
    return @sizeOf(u32);
}
export fn le_prop_display() u32 {
    return @intFromEnum(StyleProp.Display);
}
export fn le_prop_position_type() u32 {
    return @intFromEnum(StyleProp.PositionType);
}
export fn le_prop_flex_direction() u32 {
    return @intFromEnum(StyleProp.FlexDirection);
}
export fn le_prop_justify_content() u32 {
    return @intFromEnum(StyleProp.JustifyContent);
}
export fn le_prop_align_items() u32 {
    return @intFromEnum(StyleProp.AlignItems);
}
export fn le_prop_align_self() u32 {
    return @intFromEnum(StyleProp.AlignSelf);
}
export fn le_prop_flex_grow() u32 {
    return @intFromEnum(StyleProp.FlexGrow);
}
export fn le_prop_flex_shrink() u32 {
    return @intFromEnum(StyleProp.FlexShrink);
}
export fn le_prop_width() u32 {
    return @intFromEnum(StyleProp.Width);
}
export fn le_prop_height() u32 {
    return @intFromEnum(StyleProp.Height);
}
export fn le_prop_gap_row() u32 {
    return @intFromEnum(StyleProp.GapRow);
}
export fn le_prop_gap_column() u32 {
    return @intFromEnum(StyleProp.GapColumn);
}
export fn le_prop_children_count() u32 {
    return @intFromEnum(StyleProp.ChildrenCount);
}
export fn le_prop_children_offset() u32 {
    return @intFromEnum(StyleProp.ChildrenOffset);
}

// ============================================================================
// Tests
// ============================================================================

test "basic layout computation" {
    const allocator = std.testing.allocator;
    var engine = try LayoutEngine.init(allocator);
    defer engine.deinit();

    // Simple test: root with 2 children in a row
    // Root: width=100, height=100, has 2 children at offset 0
    // Child0: width=30 (fixed)
    // Child1: width=50 (fixed)
    const style_buffer = [_]f32{
        // Root (node 0) - Row layout, 2 children
        0, 0, 0, 0, 0, 0, 0, 1, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
        // Child 0 (node 1) - width=30
        0, 0, 0, 0, 0, 0, 0, 1, 30,  50,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        // Child 1 (node 2) - width=50
        0, 0, 0, 0, 0, 0, 0, 1, 50,  50,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    };
    const children_buffer = [_]u32{ 1, 2 };

    const result = le_compute(&engine, &style_buffer, style_buffer.len, &children_buffer, children_buffer.len, 3, 100, 100);
    try std.testing.expectEqual(@as(i32, 0), result);

    const results = engine.ctx.results;
    // Root at 0,0 with size 100x100
    try std.testing.expectApproxEqAbs(@as(f32, 0), results[1], 0.001); // root x
    try std.testing.expectApproxEqAbs(@as(f32, 0), results[2], 0.001); // root y
    try std.testing.expectApproxEqAbs(@as(f32, 100), results[3], 0.001); // root width
    try std.testing.expectApproxEqAbs(@as(f32, 100), results[4], 0.001); // root height

    // Child 0 at 0,0 with size 30x50
    try std.testing.expectApproxEqAbs(@as(f32, 0), results[6], 0.001); // x
    try std.testing.expectApproxEqAbs(@as(f32, 0), results[7], 0.001); // y
    try std.testing.expectApproxEqAbs(@as(f32, 30), results[8], 0.001); // width
    try std.testing.expectApproxEqAbs(@as(f32, 50), results[9], 0.001); // height

    // Child 1 at 30,0 with size 50x50
    try std.testing.expectApproxEqAbs(@as(f32, 30), results[11], 0.001); // x
    try std.testing.expectApproxEqAbs(@as(f32, 0), results[12], 0.001); // y
    try std.testing.expectApproxEqAbs(@as(f32, 50), results[13], 0.001); // width
    try std.testing.expectApproxEqAbs(@as(f32, 50), results[14], 0.001); // height
}

test "column layout" {
    const allocator = std.testing.allocator;
    var engine = try LayoutEngine.init(allocator);
    defer engine.deinit();

    // Column layout: root with 2 children stacked vertically
    // Root: width=100, height=100, Column direction, 2 children
    // Child0: height=30
    // Child1: height=50
    const style_buffer = [_]f32{
        0, 0, 1, 0, 0, 0, 0, 1, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 1, 100, 30,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 1, 100, 50,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    };
    const children_buffer = [_]u32{ 1, 2 };

    const result = le_compute(&engine, &style_buffer, style_buffer.len, &children_buffer, children_buffer.len, 3, 100, 100);
    try std.testing.expectEqual(@as(i32, 0), result);

    const results = engine.ctx.results;
    // Child 0 at y=0 with height 30
    try std.testing.expectApproxEqAbs(@as(f32, 0), results[7], 0.001); // y
    try std.testing.expectApproxEqAbs(@as(f32, 30), results[9], 0.001); // height

    // Child 1 at y=30 with height 50
    try std.testing.expectApproxEqAbs(@as(f32, 30), results[12], 0.001); // y
    try std.testing.expectApproxEqAbs(@as(f32, 50), results[14], 0.001); // height
}

test "dimension parsing" {
    try std.testing.expectApproxEqAbs(@as(f32, 100), parseDimension(100, 500), 0.001);
    try std.testing.expectApproxEqAbs(@as(f32, 100), parseDimension(-0.2, 500), 0.001);
    try std.testing.expectApproxEqAbs(@as(f32, 0), parseDimension(std.math.nan(f32), 500), 0.001);
}

test "constraints" {
    try std.testing.expectApproxEqAbs(@as(f32, 50), applyConstraints(50, 0, 0), 0.001);
    try std.testing.expectApproxEqAbs(@as(f32, 60), applyConstraints(50, 60, 0), 0.001);
    try std.testing.expectApproxEqAbs(@as(f32, 40), applyConstraints(50, 0, 40), 0.001);
    try std.testing.expectApproxEqAbs(@as(f32, 0), applyConstraints(-10, 0, 0), 0.001);
}
