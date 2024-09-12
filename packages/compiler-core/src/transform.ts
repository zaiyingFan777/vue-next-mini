import { isArray, isString } from '@vue/shared'
import { ElementTypes, NodeTypes } from './ast'
import { isSingleElementRoot } from './hoistStatic'
import { TO_DISPLAY_STRING } from './runtimeHelpers'
import { isVSlot } from './utils'

export interface TransformContext {
  /**
   * AST根节点
   */
  root
  /**
   * 每次转化时记录的父节点
   */
  parent: ParentNode | null
  /**
   * 每次转化时记录的子节点索引
   */
  childIndex: number
  /**
   * 当前处理的节点
   */
  currentNode: any
  /**
   * 协助创建 javascript ast 属性 helpers，该属性是一个 Map，key值为 Symbol（方法名），表示 render 函数中创建 《节点》 的方法
   * symbol代表render函数中生成节点的函数
   */
  helpers: Map<symbol, number>
  // 帮助我们处理helpers
  helper<T extends symbol>(name: T): T
  /**
   * 转化方法集合
   */
  nodeTransforms: any[]
  /**
   * 替换节点
   */
  replaceNode(node): void
}

/**
 * transform 上下文对象
 */
export function createTransformContext(
  root,
  { nodeTransforms = [] }
): TransformContext {
  const context: TransformContext = {
    // state
    root,
    parent: null,
    childIndex: 0,
    currentNode: root,
    helpers: new Map(),
    // methods
    helper(name) {
      // 获取helpers中name的记录
      const count = context.helpers.get(name) || 0
      // 让count++
      context.helpers.set(name, count + 1)
      return name
    },
    // options
    nodeTransforms,
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    }
  }

  return context
}

/**
 * 根据 ast 生成 javascript ast
 * 1.创建 transform context对象
 * 2.遍历转化节点，给ast的每个node添加codegenNode
 * @param root ast
 * @param options 配置对象
 */
export function transform(root, options) {
  // 1.生成transform context上下文对象
  const context = createTransformContext(root, options)

  // 2.遍历转化节点 从根节点处理（按照深度优先依次处理 node 节点转化）
  traverseNode(root, context)

  // 构建根节点的codegenNode
  createRootCodegen(root)

  root.helpers = [...context.helpers.keys()]
  root.components = []
  root.directives = []
  root.imports = []
  root.hoists = []
  root.temps = []
  root.cached = []
}

/**
 * 遍历转化节点，转化的过程一定要是深度优先的（即：孙 -> 子 -> 父），因为当前节点的状态往往需要根据子节点的情况来确定。
 * 转化的过程分为两个阶段：(深度优先遍历)
 * 1. 进入阶段：存储所有节点的转化函数到 exitFns 中
 * 2. 退出阶段：执行 exitFns 中缓存的转化函数，且一定是倒叙的。因为只有这样才能保证整个处理过程是深度优先的（到最底层后，再从低到上层依次执行 exitFns中缓存的转化函数，倒序遍历exitFns）
 */
export function traverseNode(node, context: TransformContext) {
  // 通过上下文记录当前正在处理的 node 节点
  context.currentNode = node
  // 获取当前所有 node 节点 的 transform方法（拿到转换函数）
  const { nodeTransforms } = context
  // 存储转化函数的数组
  const exitFns: any = []
  // 循环获取节点的 transform 方法，缓存到 exitFns 中（向exitFns存储转换函数）
  for (let i = 0; i < nodeTransforms.length; i++) {
    // 拿到转换函数并执行得到转换函数
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      // 指令的 transforms 返回为 数组，所以需要解构
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }

    // 比如v-if
    // 因为触发了 replaceNode，可能会导致 context.currentNode 发生变化，所以需要在这里校正
    if (!context.currentNode) {
      // 节点已删除
      return
    } else {
      // 节点变更
      // 比如处理{type: 1, tag: h1, xxxx} 然后他的props是指令，然后我们替换了node
      // 这时候context.currentNode为
      // {
      //   type: 9,
      //   branches: [
      //     {
      //       type: 10,
      //       condition: {
      //         type: 4,
      //         content: 'isShow',
      //         ...
      //       },
      //       children: [
      //         {
      //           type: 1, tag: h1, xxxx
      //         }
      //       ]
      //     }
      //   ]
      // }
      // 接下来再走 node的 type: 9 需要走if的case了
      node = context.currentNode
    }
  }

  // 继续转化子节点（处理子节点，深度优先遍历进入阶段）
  switch (node.type) {
    case NodeTypes.IF_BRANCH: // 10
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      // dfs
      traverseChildren(node, context)
      break
    // 处理插值表达式 {{}}
    case NodeTypes.INTERPOLATION:
      // 增加TO_DISPLAY_STRING
      context.helper(TO_DISPLAY_STRING)
      break
    // v-if 指令处理
    case NodeTypes.IF: // 9
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break
  }

  // 在退出时执行 transform
  // 深度优先遍历退出阶段，倒序执行exitFns
  // 标记当前正在处理的节点（开头标记，中间dfs了，currentNode变化了，所以执行到这里退出阶段的时候重新标记）
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

/**
 * 循环处理子节点
 */
export function traverseChildren(parent, context: TransformContext) {
  parent.children.forEach((node, index) => {
    // 循环中依次处理子节点
    // 记录当前正在处理的node
    context.parent = parent
    context.childIndex = index
    traverseNode(node, context)
  })
}

/**
 * 生成 root 节点下的 codegen
 */
function createRootCodegen(root) {
  const { children } = root

  // Vue 2 仅支持单个根节点
  if (children.length === 1) {
    // 获取单个根节点
    const child = children[0]
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      const codegenNode = child.codegenNode
      root.codegenNode = codegenNode
    }
  }

  // Vue 3 支持多个根节点
}

/**
 * 针对于指令的处理  transformIf = createStructuralDirectiveTransform()
 * 生成 exitFns 再被 push 到 traverseNode 中的 exitFns，然后退出阶段再挨个执行exitFns中的函数
 * template
 * <h1 v-if="isShow">hello world</h1>
 * ast
 * {
 *  type: 1, // NodeTypes.DIRECTIVE
 *  tag: "h1",
 *  tagType: 0,
 *  props: [
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
 *
 * @param name 正则。匹配具体的指令
 * @param fn 指令的具体处理方法，通常为闭包函数
 * @returns 返回一个闭包函数
 */
export function createStructuralDirectiveTransform(name: string | RegExp, fn) {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)
  // 得到 exitFns，并返回
  return (node, context) => {
    // 像上面的注释：element的props里面会有指令等等的props
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node
      // 结构的转换与 v-slot 无关
      if (node.tagType === ElementTypes.TEMPLATE && props.some(isVSlot)) {
        return
      }

      // 存储转化函数的数组
      const exitFns: any = []
      // 遍历所有的 props
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        // 仅处理指令，并且该指令要匹配指定的正则 比如transformIf处理prop.name(if)
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // 删除结构指令以避免无限递归
          props.splice(i, 1)
          i--
          // fn 会返回具体的指令函数
          // 比如transformIf 返回 processIf(...)的onExit执行函数
          // test就是fn，test2就是processIf，
          // function test() {
          //   console.log(111)
          //   return test2()
          // }
          // function test2() {
          //   console.log('test2')
          //   return () => {
          //     console.log('test2 inner')
          //   }
          // }
          // test() => test2 返回的函数 () => {...}，因此onExit还可以执行。
          const onExit = fn(node, prop, context)
          // 存储到数组中
          if (onExit) exitFns.push(onExit)
        }
      }
      // 返回包含所有函数的数组
      return exitFns
    }
  }
}
