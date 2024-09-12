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
    // 比如
    // <div><h1>hello world</h1></div>
    // 先生成h1的codegenNode，然后codegenNode在h1的js ast上，最后生成div的codegenNode，这时候div的children里面包含h1的js ast，因此生成的div的codegenNode里面的children里
    // 包含h1的codegenNode。
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
