import { isArray, isFunction, isObject, isString } from '@vue/shared'
import { normalizeClass } from 'packages/shared/src/normalizeProp'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'

export const Fragment = Symbol('Fragment')
export const Text = Symbol('Text')
export const Comment = Symbol('Comment')

// VNode接口
export interface VNode {
  __v_isVNode: true
  type: any
  props: any
  children: any
  shapeFlag: number
  key: any
}

/**
 * 根据 key || type 判断是否为相同类型节点
 */
export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  // 相同类型的元素。比如都是 div
  // 同一个元素。key 相同 表示为同一个元素
  return n1.type === n2.type && n1.key === n2.key
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

/**
 * 生成一个 VNode 对象，并返回
 * @param type vnode.type
 * @param props 标签属性或自定义属性
 * @param children 子节点
 * @returns vnode 对象
 */
export function createVNode(type, props, children?): VNode {
  // props处理
  if (props) {
    // 处理class
    let { class: klass, style } = props
    // string 就没必要处理了 props: { class: 'red' }
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
  }

  // 通过bit位处理shapeFlag类型
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : 0

  return createBaseVNode(type, props, children, shapeFlag)
}

// createElementVNode 实际调用的是 createVNode
export { createVNode as createElementVNode }

/**
 * 创建注释节点
 */
export function createCommentVNode(text) {
  return createVNode(Comment, null, text)
}

/**
 * 构建基础 VNode
 */
function createBaseVNode(type, props, children, shapeFlag) {
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    children,
    shapeFlag,
    key: props?.key || null // vnode增加 key 属性
  } as VNode

  // 标准化children
  normalizeChildren(vnode, children)

  return vnode
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode

  if (children == null) {
    children = null
  } else if (isArray(children)) {
    // array
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    // TODO: object
  } else if (isFunction(children)) {
    // TODO: function
  } else {
    // children为string
    children = String(children)
    // 为type指定Flags
    type = ShapeFlags.TEXT_CHILDREN
  }
  // 修改 vnode 的 children
  vnode.children = children
  // 按位或赋值
  vnode.shapeFlag |= type
}
