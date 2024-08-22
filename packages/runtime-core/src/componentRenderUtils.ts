import { createVNode, Text } from './vnode'

/**
 * 标准化 VNode
 */
export function normalizeVNode(child) {
  if (typeof child === 'object') {
    // 克隆 vnode
    return cloneIfMounted(child)
  } else {
    // 字符串 => Text VNode
    return createVNode(Text, null, String(child))
  }
}

/**
 * clone VNode
 */
export function cloneIfMounted(child) {
  return child
}
