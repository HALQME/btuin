const std = @import("std");
const root = @import("root.zig");

pub fn main() !void {
    const allocator = std.heap.page_allocator;
    var engine = try root.LayoutEngine.init(allocator);
    defer engine.deinit();

    const node_count = 1000;
    const style_buffer_len = node_count * root.STYLE_STRIDE;
    var style_buffer = try allocator.alloc(f32, style_buffer_len);
    defer allocator.free(style_buffer);

    // Create a deep tree structure
    @memset(style_buffer, 0);
    for (0..node_count) |i| {
        const base = i * root.STYLE_STRIDE;
        style_buffer[base] = 0; // Display: Flex
        style_buffer[base + 1] = 0; // Position: Relative
        style_buffer[base + 2] = if (i % 2 == 0) 0 else 1; // Alternate Row/Column
        style_buffer[base + 3] = 0; // Justify: FlexStart
        style_buffer[base + 4] = 0; // Align: Stretch
        style_buffer[base + 5] = 0; // AlignSelf: Auto
        style_buffer[base + 6] = if (i == node_count - 1) 0 else 1; // FlexGrow
        style_buffer[base + 7] = 1; // FlexShrink
        style_buffer[base + 8] = if (i == 0) 800 else 0; // Width (root only)
        style_buffer[base + 9] = if (i == 0) 600 else 0; // Height (root only)
        style_buffer[base + 14] = 0; // GapRow
        style_buffer[base + 15] = 0; // GapColumn
        style_buffer[base + 24] = if (i < node_count - 1) 1 else 0; // ChildrenCount
        style_buffer[base + 25] = if (i < node_count - 1) @as(f32, @floatFromInt(i)) else 0; // ChildrenOffset
    }

    // Create children buffer
    var children_buffer = try allocator.alloc(u32, node_count);
    defer allocator.free(children_buffer);
    for (0..node_count - 1) |i| {
        children_buffer[i] = @intCast(i + 1);
    }

    // Parse nodes
    const ctx = &engine.ctx;
    const nodes = ctx.nodes[0..node_count];

    var i: u32 = 0;
    while (i < node_count) : (i += 1) {
        const dims = root.parseDimensions(style_buffer, i, 800, 600);
        const children_count = @as(u32, @intFromFloat(style_buffer[i * root.STYLE_STRIDE + 24]));
        const children_start = @as(u32, @intFromFloat(style_buffer[i * root.STYLE_STRIDE + 25]));

        const child_indices = if (children_count > 0 and children_start + children_count <= node_count)
            children_buffer[children_start .. children_start + children_count]
        else
            &[_]u32{};

        nodes[i] = .{
            .id = i,
            .parent = if (i == 0) null else 0,
            .child_indices = child_indices,
            .style = root.parseStyle(style_buffer, i),
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
            .layout = root.Layout.zero(),
        };
    }

    // Benchmark
    const iterations = 1000;
    var timer = try std.time.Timer.start();

    var iter: usize = 0;
    while (iter < iterations) : (iter += 1) {
        // Reset nodes
        i = 0;
        while (i < node_count) : (i += 1) {
            nodes[i].layout = root.Layout.zero();
        }

        // Compute layout
        root.computeNodeLayout(nodes, 0, 0, 0, ctx.temp_buffer);
    }

    const elapsed = timer.read();
    const avg_ns = elapsed / iterations;
    const avg_ms = @as(f64, @floatFromInt(avg_ns)) / 1_000_000.0;

    std.debug.print("\nBenchmark Results:\n", .{});
    std.debug.print("  Nodes: {}\n", .{node_count});
    std.debug.print("  Iterations: {}\n", .{iterations});
    std.debug.print("  Total time: {d:.2}ms\n", .{@as(f64, @floatFromInt(elapsed)) / 1_000_000.0});
    std.debug.print("  Average per layout: {d:.3}ms\n", .{avg_ms});
    std.debug.print("  Layouts per second: {d:.0}\n", .{1000.0 / avg_ms});
}
