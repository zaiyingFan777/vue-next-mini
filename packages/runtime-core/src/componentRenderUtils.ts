import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { createVNode, Text } from './vnode'

/**
 * 解析 render 函数的返回值
 * @param instance 组件实例
 */
export function renderComponentRoot(instance) {
  const { vnode, render, data } = instance

  let result

  try {
    // 解析到状态组件
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 获取到 result 的返回值（render返回值为vnode），如果 render 中使用了 this，则需要修改 this 指向
      result = normalizeVNode(render!.call(data))
    }
  } catch (error) {
    console.error(error)
  }

  return result
}

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
