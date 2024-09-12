import {
  createCallExpression,
  createConditionalExpression,
  createObjectProperty,
  createSimpleExpression,
  NodeTypes
} from '../ast'
import { CREATE_COMMENT } from '../runtimeHelpers'
import {
  createStructuralDirectiveTransform,
  TransformContext
} from '../transform'
import { getMemoedVNodeCall, injectProp } from '../utils'

/**
 * transformIf === exitFns。内部保存了所有 v-if、v-else、else-if 的处理函数
 * /^(if|else|else-if)$/.test('if') => true
 *
 * node为外层
 * {
 *  type: 1, // NodeTypes.DIRECTIVE
 *  tag: "h1",
 *  tagType: 0,
 *  props: [
 *    // prop
 *    {
 *    type: 7, // NodeTypes.DIRECTIVE
 *    name: "if",
 *    exp: {
 *      type: 4, // NodeTypes.SIMPLE_EXPRESSION
 *      content: "isShow",
 *      isStatic: false,
 *      loc: {}
 *     }
 *    }
 *  ]
 * }
 */
export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      // TODO: 目前无需处理兄弟节点情况
      let key = 0

      // 退出回调。当所有子节点都已完成时，完成codegenNode
      // 下面的dfs，进入阶段生成
      // {
      //   type: NodeTypes.IF, // 9
      //   branches: [
      //     {
      //       type: NodeTypes.IF_BRANCH, // 10,
      //       condition: {
      //         type: NodeTypes.SIMPLE_EXPRESSION, // 4
      //         content: "isShow",
      //         ...
      //       },
      //       children: [
      //         {
      //           type: 1,
      //           tag: 'h1',
      //           tagType: 0,
      //           props: [],
      //           children: [{type: 2, content: "你好世界"}]
      //         }
      //       ]
      //     }
      //   ]
      // }
      // dfs退出阶段执行此方法，生成codegenNode(跟branches同级属性)
      return () => {
        if (isRoot) {
          // {
          //   type: 9 // IF,
          //   branches: ...,
          //   codegenNode: {
          //     type: 19, // NodeTypes.JS_CONDITIONAL_EXPRESSION
          //     test: condition,
          //     ...
          //   }
          // }
          ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context)
        } else {
          // TODO: 非根
        }
      }
    })
  }
)

/**
 * v-if 的转化处理
 */
export function processIf(
  node,
  dir,
  context: TransformContext,
  processCodegen?: (node, branch, isRoot: boolean) => (() => void) | undefined
) {
  // 仅处理 v-if
  if (dir.name === 'if') {
    // 创建 branch 属性
    // {
    //   type: NodeTypes.IF_BRANCH, // 10
    //   loc: node.loc,
    //   // condition: dir.exp,
    //   condition: {
    //     type: 4, // NodeTypes.SIMPLE_EXPRESSION
    //     content: "isShow",
    //     isStatic: false,
    //     constType: 0,
    //     loc: {}
    //   }
    //   children: [node]
    // }
    const branch = createIfBranch(node, dir)
    // 生成 if 指令节点，包含 branches
    const ifNode = {
      type: NodeTypes.IF, // 9
      loc: node.loc || {},
      branches: [branch]
    }
    // 切换 currentVNode，即：当前处理节点为 ifNode
    // node节点变为if节点的branches下的children
    context.replaceNode(ifNode)
    // 生成对应的 codegen 属性
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  }
}

/**
 * 创建 if 指令的 branch 属性节点
 */
function createIfBranch(node, dir) {
  return {
    type: NodeTypes.IF_BRANCH, // 10
    loc: node.loc || {},
    condition: dir.exp,
    children: [node]
  }
}

/**
 * 生成分支节点的 codegenNode
 * 为整个分支节点，添加 codegen 属性
 */
function createCodegenNodeForBranch(
  branch,
  keyIndex: number,
  context: TransformContext
) {
  if (branch.condition) {
    return createConditionalExpression(
      // test
      branch.condition,
      // 结果 consequent 就是 if true的显示结果
      // "consequent": {
      //   "type": 13,
      //   "tag": "\"h1\"",
      //   "children": [{
      //     "type": 2,
      //     "content": "你好，世界"
      //   }]
      // },
      createChildrenCodegenNode(branch, keyIndex),
      // 以注释的形式展示 v-if.
      // alternate: {
      //   type: NodeTypes.JS_CALL_EXPRESSION, // 14
      //   callee: CREATE_COMMENT, // createCommentVNode
      //   loc: {},
      //   arguments: ["v-if", "true"]
      // }
      // {
      //   "type": 14,
      //   "loc": {},
      //   "arguments": ["\"v-if\"", "true"],
      //   callee: Symbol(createCommentVNode)
      // }
      createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', 'true'])
    )
  } else {
    return createChildrenCodegenNode(branch, keyIndex)
  }
}

/**
 * 创建指定子节点的 codegen 节点
 */
function createChildrenCodegenNode(branch, keyIndex: number) {
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false)
  )
  const { children } = branch
  const firstChild = children[0]

  const ret = firstChild.codegenNode
  const vnodeCall = getMemoedVNodeCall(ret)
  // 填充 props
  // vnodeCall
  injectProp(vnodeCall, keyProperty)
  return ret
}

// import {
//   createCallExpression,
//   createConditionalExpression,
//   createObjectProperty,
//   createSimpleExpression,
//   ElementTypes,
//   NodeTypes
// } from '../ast'
// import { CREATE_COMMENT } from '../runtimeHelpers'
// import {
//   createStructuralDirectiveTransform,
//   TransformContext
// } from '../transform'
// import { getMemoedVNodeCall, injectProp } from '../utils'

// /**
//  * transformIf === exitFns。内部保存了所有 v-if、v-else、else-if 的处理函数
//  */
// export const transformIf = createStructuralDirectiveTransform(
//   /^(if|else|else-if)$/,
//   (node, dir, context) => {
//     return processIf(node, dir, context, (ifNode, branch, isRoot) => {
//       // TODO: 目前无需处理兄弟节点情况
//       let key = 0

//       // 退出回调。当所有子节点都已完成时，完成codegenNode
//       return () => {
//         if (isRoot) {
//           ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context)
//         } else {
//           // TODO: 非根
//         }
//       }
//     })
//   }
// )

// /**
//  * v-if 的转化处理
//  */
// export function processIf(
//   node,
//   dir,
//   context: TransformContext,
//   processCodegen?: (node, branch, isRoot: boolean) => (() => void) | undefined
// ) {
//   // 仅处理 v-if
//   if (dir.name === 'if') {
//     // 创建 branch 属性
//     const branch = createIfBranch(node, dir)
//     // 生成 if 指令节点，包含 branches
//     const ifNode = {
//       type: NodeTypes.IF,
//       loc: node.loc || {},
//       branches: [branch]
//     }
//     // 切换 currentVNode，即：当前处理节点为 ifNode
//     context.replaceNode(ifNode)
//     // 生成对应的 codegen 属性
//     if (processCodegen) {
//       return processCodegen(ifNode, branch, true)
//     }
//   }
// }

// /**
//  * 创建 if 指令的 branch 属性节点
//  */
// function createIfBranch(node, dir) {
//   return {
//     type: NodeTypes.IF_BRANCH,
//     loc: node.loc || {},
//     condition: dir.exp,
//     children: [node]
//   }
// }

// /**
//  * 生成分支节点的 codegenNode
//  */
// function createCodegenNodeForBranch(
//   branch,
//   keyIndex: number,
//   context: TransformContext
// ) {
//   if (branch.condition) {
//     return createConditionalExpression(
//       // test
//       branch.condition,
//       // 结果 consequent
//       createChildrenCodegenNode(branch, keyIndex),
//       // 以注释的形式展示 v-if.
//       // alternate
//       // {
//       //   "type": 14,
//       //   "loc": {},
//       //   "arguments": ["\"v-if\"", "true"],
//       //   callee: Symbol(createCommentVNode)
//       // }
//       createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', 'true'])
//     )
//   } else {
//     return createChildrenCodegenNode(branch, keyIndex)
//   }
// }

// /**
//  * 创建指定子节点的 codegen 节点
//  */
// function createChildrenCodegenNode(branch, keyIndex: number) {
//   const keyProperty = createObjectProperty(
//     `key`,
//     createSimpleExpression(`${keyIndex}`, false)
//   )
//   const { children } = branch
//   const firstChild = children[0]

//   const ret = firstChild.codegenNode
//   const vnodeCall = getMemoedVNodeCall(ret)
//   // 填充 props
//   injectProp(vnodeCall, keyProperty)
//   return ret
// }
