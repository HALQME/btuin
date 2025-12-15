use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet, hash_map::Entry};
use taffy::prelude::*;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
struct JsNodeUpdate {
    key: String,
    style: JsStyle,
    #[serde(default)]
    children: Vec<String>,
}

#[derive(Deserialize)]
struct JsSize {
    width: f32,
    height: f32,
}

#[derive(Deserialize, Default)]
struct JsStyle {
    display: Option<String>,
    position: Option<String>,

    width: Option<JsDimension>,
    height: Option<JsDimension>,
    min_width: Option<JsDimension>,
    min_height: Option<JsDimension>,
    max_width: Option<JsDimension>,
    max_height: Option<JsDimension>,
    size: Option<JsSize>,

    padding: Option<Vec<f32>>, // [left, right, top, bottom]
    margin: Option<Vec<f32>>,  // [left, right, top, bottom]

    flex_direction: Option<String>,
    flex_wrap: Option<String>,
    flex_grow: Option<f32>,
    flex_shrink: Option<f32>,
    flex_basis: Option<JsDimension>,

    justify_content: Option<String>,
    align_items: Option<String>,
    align_self: Option<String>,

    gap: Option<JsSize>,
}

// JSからの入力値 ("auto", 100, "50%") を受け取るEnum
#[derive(Deserialize)]
#[serde(untagged)]
enum JsDimension {
    Auto(String), // "auto"
    Points(f32),  // 100
    Str(String),  // "50%"
}

impl JsDimension {
    // Dimension (width, height, flex_basis 等) への変換
    fn to_dimension(&self) -> Dimension {
        match self {
            JsDimension::Points(v) => length(*v),
            JsDimension::Auto(s) if s == "auto" => auto(),
            JsDimension::Str(s) if s == "auto" => auto(),
            JsDimension::Str(s) if s.ends_with("%") => {
                let v = s.trim_end_matches('%').parse::<f32>().unwrap_or(0.0);
                percent(v / 100.0)
            }
            _ => auto(),
        }
    }
}

#[derive(Serialize)]
struct LayoutOutput {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}

impl From<&JsStyle> for Style {
    fn from(js: &JsStyle) -> Self {
        let mut style = Style::default();

        // Display & Position
        if let Some(d) = js.display.as_deref() {
            style.display = match d {
                "none" => Display::None,
                _ => Display::Flex,
            };
        }
        if let Some(p) = js.position.as_deref() {
            style.position = match p {
                "absolute" => Position::Absolute,
                _ => Position::Relative,
            };
        }

        // Size
        if let Some(s) = &js.size {
            style.size = Size {
                width: length(s.width),
                height: length(s.height),
            };
        } else {
            if let Some(d) = &js.width {
                style.size.width = d.to_dimension();
            }
            if let Some(d) = &js.height {
                style.size.height = d.to_dimension();
            }
        }
        if let Some(d) = &js.min_width {
            style.min_size.width = d.to_dimension();
        }
        if let Some(d) = &js.min_height {
            style.min_size.height = d.to_dimension();
        }
        if let Some(d) = &js.max_width {
            style.max_size.width = d.to_dimension();
        }
        if let Some(d) = &js.max_height {
            style.max_size.height = d.to_dimension();
        }

        // Spacing (Padding)
        if let Some(p) = &js.padding {
            if p.len() == 4 {
                style.padding = Rect {
                    left: length(p[0]),
                    right: length(p[1]),
                    top: length(p[2]),
                    bottom: length(p[3]),
                };
            }
        }

        // Spacing (Margin)
        if let Some(m) = &js.margin {
            if m.len() == 4 {
                style.margin = Rect {
                    left: length(m[0]),
                    right: length(m[1]),
                    top: length(m[2]),
                    bottom: length(m[3]),
                };
            }
        }

        // Flex
        if let Some(dir) = js.flex_direction.as_deref() {
            style.flex_direction = match dir {
                "row" => FlexDirection::Row,
                "column" => FlexDirection::Column,
                "row-reverse" => FlexDirection::RowReverse,
                "column-reverse" => FlexDirection::ColumnReverse,
                _ => FlexDirection::Row,
            };
        }
        if let Some(wrap) = js.flex_wrap.as_deref() {
            style.flex_wrap = match wrap {
                "nowrap" => FlexWrap::NoWrap,
                "wrap" => FlexWrap::Wrap,
                "wrap-reverse" => FlexWrap::WrapReverse,
                _ => FlexWrap::NoWrap,
            };
        }
        if let Some(g) = js.flex_grow {
            style.flex_grow = g;
        }
        if let Some(s) = js.flex_shrink {
            style.flex_shrink = s;
        }
        if let Some(b) = &js.flex_basis {
            style.flex_basis = b.to_dimension();
        }

        // Alignment
        if let Some(jc) = js.justify_content.as_deref() {
            style.justify_content = match jc {
                "flex-start" => Some(JustifyContent::FlexStart),
                "flex-end" => Some(JustifyContent::FlexEnd),
                "center" => Some(JustifyContent::Center),
                "space-between" => Some(JustifyContent::SpaceBetween),
                "space-around" => Some(JustifyContent::SpaceAround),
                "space-evenly" => Some(JustifyContent::SpaceEvenly),
                _ => None,
            };
        }
        if let Some(ai) = js.align_items.as_deref() {
            style.align_items = match ai {
                "flex-start" => Some(AlignItems::FlexStart),
                "flex-end" => Some(AlignItems::FlexEnd),
                "center" => Some(AlignItems::Center),
                "baseline" => Some(AlignItems::Baseline),
                "stretch" => Some(AlignItems::Stretch),
                _ => None,
            };
        }
        if let Some(as_) = js.align_self.as_deref() {
            style.align_self = match as_ {
                "auto" => None,
                "flex-start" => Some(AlignSelf::FlexStart),
                "flex-end" => Some(AlignSelf::FlexEnd),
                "center" => Some(AlignSelf::Center),
                "baseline" => Some(AlignSelf::Baseline),
                "stretch" => Some(AlignSelf::Stretch),
                _ => None,
            };
        }

        // Gap
        if let Some(gap) = &js.gap {
            style.gap.width = length(gap.width);
            style.gap.height = length(gap.height);
        }

        style
    }
}

struct LayoutEngineState {
    taffy: TaffyTree<Size<f32>>,
    nodes: HashMap<String, NodeInfo>,
}

struct NodeInfo {
    id: NodeId,
}

impl LayoutEngineState {
    fn new() -> Self {
        Self {
            taffy: TaffyTree::new(),
            nodes: HashMap::new(),
        }
    }

    fn update_nodes(&mut self, nodes: Vec<JsNodeUpdate>) -> Result<(), String> {
        for node in &nodes {
            let style: Style = (&node.style).into();
            match self.nodes.entry(node.key.clone()) {
                Entry::Occupied(entry) => {
                    self.taffy
                        .set_style(entry.get().id, style)
                        .map_err(|e| e.to_string())?;
                }
                Entry::Vacant(entry) => {
                    let id = self.taffy.new_leaf(style).map_err(|e| e.to_string())?;
                    entry.insert(NodeInfo { id });
                }
            }
        }

        for node in &nodes {
            if let Some(info) = self.nodes.get(&node.key) {
                let child_ids: Vec<NodeId> = node
                    .children
                    .iter()
                    .filter_map(|child_key| {
                        self.nodes.get(child_key).map(|child_info| child_info.id)
                    })
                    .collect();
                self.taffy
                    .set_children(info.id, &child_ids)
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(())
    }

    fn remove_nodes(&mut self, keys: Vec<String>) -> Result<(), String> {
        let key_set: HashSet<String> = keys.into_iter().collect();
        for key in &key_set {
            if let Some(info) = self.nodes.remove(key) {
                self.taffy.remove(info.id).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    fn compute_layout(&mut self, root_key: &str) -> Result<HashMap<String, LayoutOutput>, String> {
        let root = self
            .nodes
            .get(root_key)
            .ok_or_else(|| format!("root node not found: {}", root_key))?;

        self.taffy
            .compute_layout(root.id, Size::MAX_CONTENT)
            .map_err(|e| e.to_string())?;

        let mut outputs = HashMap::with_capacity(self.nodes.len());
        for (key, info) in &self.nodes {
            let layout = self.taffy.layout(info.id).map_err(|e| e.to_string())?;
            outputs.insert(
                key.clone(),
                LayoutOutput {
                    x: layout.location.x,
                    y: layout.location.y,
                    width: layout.size.width,
                    height: layout.size.height,
                },
            );
        }

        Ok(outputs)
    }
}

thread_local! {
    static ENGINE_STATE: RefCell<Option<LayoutEngineState>> = RefCell::new(None);
}

fn with_state<R>(
    f: impl FnOnce(&mut LayoutEngineState) -> Result<R, String>,
) -> Result<R, JsValue> {
    ENGINE_STATE.with(|cell| {
        let mut guard = cell.borrow_mut();
        let state = guard
            .as_mut()
            .ok_or_else(|| JsValue::from_str("Layout engine not initialized"))?;
        f(state).map_err(|e| JsValue::from_str(&e))
    })
}

#[wasm_bindgen]
pub fn init_layout_engine() -> Result<(), JsValue> {
    ENGINE_STATE.with(|cell| {
        let mut guard = cell.borrow_mut();
        *guard = Some(LayoutEngineState::new());
        Ok(())
    })
}

#[wasm_bindgen]
pub fn update_nodes(nodes_js: JsValue) -> Result<(), JsValue> {
    let nodes: Vec<JsNodeUpdate> = serde_wasm_bindgen::from_value(nodes_js)?;
    with_state(|state| state.update_nodes(nodes))
}

#[wasm_bindgen]
pub fn remove_nodes(keys_js: JsValue) -> Result<(), JsValue> {
    let keys: Vec<String> = serde_wasm_bindgen::from_value(keys_js)?;
    with_state(|state| state.remove_nodes(keys))
}

#[wasm_bindgen]
pub fn compute_layout(root_key: &str) -> Result<JsValue, JsValue> {
    with_state(|state| state.compute_layout(root_key)).and_then(|outputs| {
        serde_wasm_bindgen::to_value(&outputs).map_err(|e| JsValue::from_str(&e.to_string()))
    })
}
