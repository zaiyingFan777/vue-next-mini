import { NodeTypes } from './ast'
import { CREATE_ELEMENT_VNODE, CREATE_VNODE } from './runtimeHelpers'

export function isText(node) {
  // NodeTypes.INTERPOLATION 表达式节点
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}

/**
 * 返回 vnode 生成函数 createVNode 或 createElementVNode
 * @param ssr
 * @param isComponent
 * @returns
 */
export function getVNodeHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}
