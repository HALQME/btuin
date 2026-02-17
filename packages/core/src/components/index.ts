export {
  defineComponent,
  handleComponentKey,
  isComponent,
  mountComponent,
  renderComponent,
  unmountComponent,
} from "./component";
export { createComponent } from "./core";
export { onBeforeUpdate, onKey, onMounted, onTick, onUnmounted, onUpdated } from "./lifecycle";
export { inject, provide, type InjectionKey } from "./provide-inject";
