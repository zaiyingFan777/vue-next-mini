import { createCompoundExpression, NodeTypes } from '../ast'
import { isText } from '../utils'

/**
 * 将相邻的文本节点和表达式合并为一个表达式。
 *
 * 例如:
 * <div>hello {{ msg }}</div>
 * 上述模板包含两个节点：
 * 1. hello：TEXT 文本节点
 * 2. {{ msg }}：INTERPOLATION 表达式节点  NodeTypes.INTERPOLATION = 5
 * 这两个节点在生成 render 函数时，需要被合并： 'hello' + _toDisplayString(_ctx.msg)
 * 那么在合并时就要多出来这个 + 加号。
 * 例如：
 * children:[
 * 	{ TEXT 文本节点 },
 *  " + ",
 *  { INTERPOLATION 表达式节点 }
 * ]
 */
export const transformText = (node, context) => {
  // <div>hello world</div>  当currentNode为div的时候会将这个方法放到exitFns里面，当currentNode为hello world的时候 不会把此方法放到 exitFns 里面
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    return () => {
      // 获取所有的子节点
      const children = node.children
      // 当前容器
      let currentContainer
      // 循环处理所有的子节点
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          // 文本 或 表达式
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]

            // 当前节点 child 和 下一个节点 next 都是 Text 节点
            if (isText(next)) {
              if (!currentContainer) {
                // createCompundExpression 生成一个符合表达式的节点
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                )
              }

              // 在 当前节点 child 和 下一个节点 next 中间，插入 "+" 号
              // 合并 child + next
              currentContainer.children.push(` + `, next)
              // children删掉j（把下一个删除）因为currentContainer.children.push(` + `, next)已经处理了j，所以需要先将j删除，再j--，进入下一轮循环j++
              // 这样就处理j下一个元素了
              children.splice(j, 1)
              j--
            }
            // 当前节点 child 是 Text 节点，下一个节点 next 不是 Text节点，则把 currentContainer 置空即可
            else {
              // children[i]为文本、children[j]不为文本，不需要合并
              currentContainer = undefined
              // 退出j循环
              break
            }
          }
        }
      }
    }
  }
}
