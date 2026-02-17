#![allow(dead_code)]
use std::collections::HashMap;
use taffy::prelude::*;

#[repr(C)]
enum StyleProp {
    Display,
    PositionType,
    FlexDirection,
    FlexWrap,
    JustifyContent,
    AlignItems,
    AlignSelf,
    FlexGrow,
    FlexShrink,
    FlexBasis,
    Width,
    Height,
    MinWidth,
    MinHeight,
    MaxWidth,
    MaxHeight,
    MarginLeft,
    MarginRight,
    MarginTop,
    MarginBottom,
    PaddingLeft,
    PaddingRight,
    PaddingTop,
    PaddingBottom,
    GapRow,
    GapColumn,
    ChildrenCount,
    ChildrenOffset,
    TotalProps,
}
const STYLE_STRIDE: usize = StyleProp::TotalProps as usize;
const RESULT_STRIDE: usize = 5; // js_id, x, y, width, height

// Increment this when changing any exported FFI surface or buffer layout.
const LAYOUT_ENGINE_ABI_VERSION: u32 = 2;

#[repr(u32)]
enum OpCode {
    CreateLeaf = 1,
    UpdateStyle = 2,
    SetChildren = 3,
    RemoveNode = 4,
}

pub struct LayoutEngineState {
    taffy: TaffyTree,
    nodes: HashMap<u32, NodeId>,
    node_id_map: HashMap<NodeId, u32>,
    results_buffer: Vec<f32>,
}

impl LayoutEngineState {
    fn new() -> Self {
        Self {
            taffy: TaffyTree::with_capacity(15000),
            nodes: HashMap::with_capacity(15000),
            node_id_map: HashMap::with_capacity(15000),
            results_buffer: Vec::with_capacity(15000 * 5),
        }
    }

    fn style_from_slice(style_slice: &[f32]) -> Style {
        let mut style = Style::default();

        let width = style_slice[StyleProp::Width as usize];
        if !width.is_nan() {
            style.size.width = length(width);
        }

        let height = style_slice[StyleProp::Height as usize];
        if !height.is_nan() {
            style.size.height = length(height);
        }

        style.flex_direction = match style_slice[StyleProp::FlexDirection as usize] as i32 {
            1 => FlexDirection::Column,
            2 => FlexDirection::RowReverse,
            3 => FlexDirection::ColumnReverse,
            _ => FlexDirection::Row,
        };

        style.gap = Size {
            width: length(style_slice[StyleProp::GapColumn as usize]),
            height: length(style_slice[StyleProp::GapRow as usize]),
        };

        style.justify_content = Some(
            match style_slice[StyleProp::JustifyContent as usize] as i32 {
                1 => JustifyContent::FlexEnd,
                2 => JustifyContent::Center,
                3 => JustifyContent::SpaceBetween,
                4 => JustifyContent::SpaceAround,
                5 => JustifyContent::SpaceEvenly,
                _ => JustifyContent::FlexStart,
            },
        );

        style.align_items = Some(match style_slice[StyleProp::AlignItems as usize] as i32 {
            0 => AlignItems::FlexStart,
            1 => AlignItems::FlexEnd,
            2 => AlignItems::Center,
            3 => AlignItems::Baseline,
            _ => AlignItems::Stretch,
        });

        style.position = match style_slice[StyleProp::PositionType as usize] as i32 {
            1 => Position::Absolute,
            _ => Position::Relative,
        };

        style.flex_grow = style_slice[StyleProp::FlexGrow as usize];
        style.flex_shrink = style_slice[StyleProp::FlexShrink as usize];

        style.margin = Rect {
            left: length(style_slice[StyleProp::MarginLeft as usize]),
            right: length(style_slice[StyleProp::MarginRight as usize]),
            top: length(style_slice[StyleProp::MarginTop as usize]),
            bottom: length(style_slice[StyleProp::MarginBottom as usize]),
        };
        style.padding = Rect {
            left: length(style_slice[StyleProp::PaddingLeft as usize]),
            right: length(style_slice[StyleProp::PaddingRight as usize]),
            top: length(style_slice[StyleProp::PaddingTop as usize]),
            bottom: length(style_slice[StyleProp::PaddingBottom as usize]),
        };

        style
    }

    fn compute_results(&mut self, root_node: NodeId) {
        self.taffy
            .compute_layout(root_node, Size::MAX_CONTENT)
            .unwrap();

        self.results_buffer.clear();
        for (taffy_id, js_id) in &self.node_id_map {
            if let Ok(layout) = self.taffy.layout(*taffy_id) {
                self.results_buffer.push(*js_id as f32);
                self.results_buffer.push(layout.location.x);
                self.results_buffer.push(layout.location.y);
                self.results_buffer.push(layout.size.width);
                self.results_buffer.push(layout.size.height);
            }
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn create_engine() -> *mut LayoutEngineState {
    Box::into_raw(Box::new(LayoutEngineState::new()))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy_engine(ptr: *mut LayoutEngineState) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        drop(Box::from_raw(ptr));
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn compute_layout_from_buffers(
    engine_ptr: *mut LayoutEngineState,
    nodes_buffer_ptr: *const f32,
    nodes_buffer_len: usize,
    children_buffer_ptr: *const u32,
    children_buffer_len: usize,
) -> i32 {
    if engine_ptr.is_null() {
        return -1;
    }

    let engine = unsafe { &mut *engine_ptr };
    let nodes_buffer: &[f32] = if nodes_buffer_len == 0 {
        &[]
    } else if nodes_buffer_ptr.is_null() {
        return -4;
    } else {
        unsafe { std::slice::from_raw_parts(nodes_buffer_ptr, nodes_buffer_len) }
    };
    let children_buffer: &[u32] = if children_buffer_len == 0 {
        &[]
    } else if children_buffer_ptr.is_null() {
        return -5;
    } else {
        unsafe { std::slice::from_raw_parts(children_buffer_ptr, children_buffer_len) }
    };

    let node_count = nodes_buffer_len / STYLE_STRIDE;
    if nodes_buffer_len % STYLE_STRIDE != 0 {
        return -2;
    }

    engine.nodes.clear();
    engine.node_id_map.clear();
    engine.taffy.clear();

    for i in 0..node_count {
        let node_id = i as u32;
        let style_slice = &nodes_buffer[i * STYLE_STRIDE..(i + 1) * STYLE_STRIDE];
        let style = LayoutEngineState::style_from_slice(style_slice);

        let taffy_node = engine.taffy.new_leaf(style).unwrap();
        engine.nodes.insert(node_id, taffy_node);
        engine.node_id_map.insert(taffy_node, node_id);
    }

    for i in 0..node_count {
        let node_id = i as u32;
        let style_slice = &nodes_buffer[i * STYLE_STRIDE..(i + 1) * STYLE_STRIDE];
        let children_count = style_slice[StyleProp::ChildrenCount as usize] as usize;
        if children_count > 0 {
            let children_offset = style_slice[StyleProp::ChildrenOffset as usize] as usize;
            let children_ids_slice =
                &children_buffer[children_offset..children_offset + children_count];
            let taffy_children: Vec<NodeId> = children_ids_slice
                .iter()
                .filter_map(|child_id| engine.nodes.get(child_id))
                .map(|id| *id)
                .collect();
            if let Some(taffy_node) = engine.nodes.get(&node_id) {
                engine
                    .taffy
                    .set_children(*taffy_node, &taffy_children)
                    .unwrap();
            }
        }
    }

    let Some(root_node) = engine.nodes.get(&0).copied() else {
        return -3;
    };

    engine.compute_results(root_node);

    0
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn apply_ops_and_compute(
    engine_ptr: *mut LayoutEngineState,
    ops_ptr: *const u32,
    ops_len: usize,
    styles_ptr: *const f32,
    styles_len: usize,
    children_ptr: *const u32,
    children_len: usize,
) -> i32 {
    if engine_ptr.is_null() {
        return -1;
    }

    let engine = unsafe { &mut *engine_ptr };
    let ops: &[u32] = if ops_len == 0 {
        &[]
    } else if ops_ptr.is_null() {
        return -6;
    } else {
        unsafe { std::slice::from_raw_parts(ops_ptr, ops_len) }
    };
    let styles: &[f32] = if styles_len == 0 {
        &[]
    } else if styles_ptr.is_null() {
        return -7;
    } else {
        unsafe { std::slice::from_raw_parts(styles_ptr, styles_len) }
    };
    let children: &[u32] = if children_len == 0 {
        &[]
    } else if children_ptr.is_null() {
        return -8;
    } else {
        unsafe { std::slice::from_raw_parts(children_ptr, children_len) }
    };

    let mut i = 0;
    while i < ops.len() {
        let opcode = ops[i];
        i += 1;

        match opcode {
            x if x == OpCode::CreateLeaf as u32 => {
                if i + 2 > ops.len() {
                    return -10;
                }
                let node_id = ops[i];
                let style_offset = ops[i + 1] as usize;
                i += 2;

                if style_offset + STYLE_STRIDE > styles.len() {
                    return -11;
                }

                let style = LayoutEngineState::style_from_slice(
                    &styles[style_offset..style_offset + STYLE_STRIDE],
                );

                let taffy_node = engine.taffy.new_leaf(style).unwrap();
                engine.nodes.insert(node_id, taffy_node);
                engine.node_id_map.insert(taffy_node, node_id);
            }
            x if x == OpCode::UpdateStyle as u32 => {
                if i + 2 > ops.len() {
                    return -12;
                }
                let node_id = ops[i];
                let style_offset = ops[i + 1] as usize;
                i += 2;

                if style_offset + STYLE_STRIDE > styles.len() {
                    return -13;
                }

                let Some(taffy_node) = engine.nodes.get(&node_id).copied() else {
                    return -14;
                };

                let style = LayoutEngineState::style_from_slice(
                    &styles[style_offset..style_offset + STYLE_STRIDE],
                );
                engine.taffy.set_style(taffy_node, style).unwrap();
            }
            x if x == OpCode::SetChildren as u32 => {
                if i + 3 > ops.len() {
                    return -15;
                }
                let node_id = ops[i];
                let children_offset = ops[i + 1] as usize;
                let children_count = ops[i + 2] as usize;
                i += 3;

                let Some(taffy_node) = engine.nodes.get(&node_id).copied() else {
                    return -16;
                };

                if children_offset + children_count > children.len() {
                    return -17;
                }

                let mut taffy_children: Vec<NodeId> = Vec::with_capacity(children_count);
                for child_id in &children[children_offset..children_offset + children_count] {
                    let Some(child_node) = engine.nodes.get(child_id).copied() else {
                        return -18;
                    };
                    taffy_children.push(child_node);
                }
                engine
                    .taffy
                    .set_children(taffy_node, &taffy_children)
                    .unwrap();
            }
            x if x == OpCode::RemoveNode as u32 => {
                if i + 1 > ops.len() {
                    return -19;
                }
                let node_id = ops[i];
                i += 1;

                if let Some(taffy_node) = engine.nodes.remove(&node_id) {
                    engine.node_id_map.remove(&taffy_node);
                    let _ = engine.taffy.remove(taffy_node);
                }
            }
            _ => return -20,
        }
    }

    let Some(root_node) = engine.nodes.get(&0).copied() else {
        return -3;
    };

    engine.compute_results(root_node);
    0
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn get_results_ptr(engine_ptr: *mut LayoutEngineState) -> *const f32 {
    if engine_ptr.is_null() {
        return std::ptr::null();
    }
    let engine = unsafe { &*engine_ptr };
    engine.results_buffer.as_ptr()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn get_results_len(engine_ptr: *mut LayoutEngineState) -> usize {
    if engine_ptr.is_null() {
        return 0;
    }
    let engine = unsafe { &*engine_ptr };
    engine.results_buffer.len()
}

// --- FFI boundary introspection (for sync tests) ---

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_abi_version() -> u32 {
    LAYOUT_ENGINE_ABI_VERSION
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_stride() -> u32 {
    STYLE_STRIDE as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_result_stride() -> u32 {
    RESULT_STRIDE as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_f32_size() -> u32 {
    std::mem::size_of::<f32>() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_u32_size() -> u32 {
    std::mem::size_of::<u32>() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_flex_grow() -> u32 {
    StyleProp::FlexGrow as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_flex_shrink() -> u32 {
    StyleProp::FlexShrink as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_flex_direction() -> u32 {
    StyleProp::FlexDirection as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_width() -> u32 {
    StyleProp::Width as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_height() -> u32 {
    StyleProp::Height as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_gap_row() -> u32 {
    StyleProp::GapRow as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_gap_column() -> u32 {
    StyleProp::GapColumn as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_children_count() -> u32 {
    StyleProp::ChildrenCount as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn layout_engine_style_prop_children_offset() -> u32 {
    StyleProp::ChildrenOffset as u32
}
