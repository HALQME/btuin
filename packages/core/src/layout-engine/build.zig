const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Options
    const strip_symbols = b.option(bool, "strip", "Strip debug symbols") orelse (optimize == .ReleaseFast or optimize == .ReleaseSmall);

    // Shared library for FFI
    const lib_mod = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "layout-engine",
        .root_module = lib_mod,
    });
    lib.root_module.strip = strip_symbols;

    // Set library output name based on platform
    if (target.result.os.tag == .windows) {
        lib.root_module.addCMacro("_WINDOWS", "1");
    }

    b.installArtifact(lib);

    // Static library
    const static_lib = b.addLibrary(.{
        .linkage = .static,
        .name = "layout-engine-static",
        .root_module = lib_mod,
    });
    static_lib.root_module.strip = strip_symbols;
    b.installArtifact(static_lib);

    // Unit tests
    const test_mod = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = .Debug,
    });

    const unit_tests = b.addTest(.{
        .root_module = test_mod,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    // Benchmark executable
    const bench_mod = b.createModule(.{
        .root_source_file = b.path("src/bench.zig"),
        .target = target,
        .optimize = .ReleaseFast,
    });

    const bench = b.addExecutable(.{
        .name = "layout-bench",
        .root_module = bench_mod,
    });
    b.installArtifact(bench);

    const run_bench = b.addRunArtifact(bench);
    const bench_step = b.step("bench", "Run benchmarks");
    bench_step.dependOn(&run_bench.step);

    // Release build for all platforms
    const release_step = b.step("release", "Build release binaries for all platforms");

    const platforms = .{
        .{ .target = "aarch64-macos", .name = "macos-arm64" },
        .{ .target = "x86_64-macos", .name = "macos-x64" },
        .{ .target = "x86_64-linux-gnu", .name = "linux-x64" },
        .{ .target = "aarch64-linux-gnu", .name = "linux-arm64" },
        .{ .target = "x86_64-windows-gnu", .name = "windows-x64" },
    };

    inline for (platforms) |plat| {
        const plat_target = b.resolveTargetQuery(std.Target.Query.parse(.{
            .arch_os_abi = plat.target,
        }) catch unreachable);

        const plat_mod = b.createModule(.{
            .root_source_file = b.path("src/root.zig"),
            .target = plat_target,
            .optimize = .ReleaseFast,
        });

        const plat_lib = b.addLibrary(.{
            .linkage = .dynamic,
            .name = b.fmt("layout-engine-{s}", .{plat.name}),
            .root_module = plat_mod,
        });
        plat_lib.root_module.strip = true;

        release_step.dependOn(&b.addInstallArtifact(plat_lib, .{}).step);
    }
}
