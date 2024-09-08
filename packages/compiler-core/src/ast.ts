import { CREATE_ELEMENT_VNODE } from './runtimeHelpers'

/**
 * 节点类型（我们这里复制了所有的节点类型，但是我们实际上只用到了极少的部分）
 */
export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  // 表达式
  INTERPOLATION,
  ATTRIBUTE,
  DIRECTIVE,
  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,
  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT
}

/**
 * Element 标签类型
 */
export const enum ElementTypes {
  /**
   * element，例如：<div>
   */
  ELEMENT,
  /**
   * 组件
   */
  COMPONENT,
  /**
   * 插槽
   */
  SLOT,
  /**
   * template
   */
  TEMPLATE
}

export function createVNodeCall(context, tag, props?, children?) {
  if (context) {
    // 让 helpers => {Symbol('createElementVNode'): 1}
    context.helper(CREATE_ELEMENT_VNODE)
  }

  return {
    type: NodeTypes.VNODE_CALL, // 13
    tag,
    props,
    children
  }
}

/**
 * return hello {{ msg }} 复合表达式
 * 创建复合表达式的节点
 */
export function createCompoundExpression(children, loc) {
  return {
    // 表达式的节点
    type: NodeTypes.COMPOUND_EXPRESSION,
    children,
    loc
  }
}
