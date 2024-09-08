export const CREATE_ELEMENT_VNODE = Symbol('createElementVNode')
export const CREATE_VNODE = Symbol('createVNode')

/**
 * const { xxx } = Vue
 * 即：从 Vue 中可以被导出的方法，我们这这里统一使用 createVNode
 */
export const helperNameMap = {
  // 在 renderer 中，通过 export { createVNode as createElementVNode }
  [CREATE_ELEMENT_VNODE]: 'createElementVNode',
  [CREATE_VNODE]: 'createVNode'
}
