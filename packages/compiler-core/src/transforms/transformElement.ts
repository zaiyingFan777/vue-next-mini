import { createVNodeCall, NodeTypes } from '../ast'

/**
 * 对 element 节点的转化方法
 */
export const transformElement = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode!

    // 仅处理 ELEMENT 类型
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }

    // 拿到 div p
    const { tag } = node
    // "div"
    let vnodeTag = `"${tag}"`
    let vnodeProps = []
    let vnodeChildren = node.children

    // 给node添加codegenNode属性
    node.codegenNode = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren
    )
  }
}
