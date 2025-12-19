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

    let (engine, nodes_buffer, children_buffer) = unsafe {
        (
            &mut *engine_ptr,
            std::slice::from_raw_parts(nodes_buffer_ptr, nodes_buffer_len),
            std::slice::from_raw_parts(children_buffer_ptr, children_buffer_len),
        )
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

        style.justify_content = Some(match style_slice[StyleProp::JustifyContent as usize] as i32 {
            1 => JustifyContent::FlexEnd,
            2 => JustifyContent::Center,
            3 => JustifyContent::SpaceBetween,
            4 => JustifyContent::SpaceAround,
            5 => JustifyContent::SpaceEvenly,
            _ => JustifyContent::FlexStart,
        });

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

    if let Some(root_node) = engine.nodes.get(&0) {
        engine
            .taffy
            .compute_layout(*root_node, Size::MAX_CONTENT)
            .unwrap();
    } else {
        return -3;
    }

    engine.results_buffer.clear();
    for (taffy_id, js_id) in &engine.node_id_map {
        if let Ok(layout) = engine.taffy.layout(*taffy_id) {
            engine.results_buffer.push(*js_id as f32);
            engine.results_buffer.push(layout.location.x);
            engine.results_buffer.push(layout.location.y);
            engine.results_buffer.push(layout.size.width);
            engine.results_buffer.push(layout.size.height);
        }
    }

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
