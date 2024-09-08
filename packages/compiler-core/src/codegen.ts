import { isArray, isString } from '@vue/shared'
import { NodeTypes } from './ast'
import { helperNameMap } from './runtimeHelpers'
import { getVNodeHelper } from './utils'

/**
 * 别名助手
 */
const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`

// 函数的生成方案，分为三部分：
// 1.函数本质上就是一段字符
// 2.字符串的拼接方式
// 3.字符串拼接的格式处理
// 函数本质上就是一段字符

// 最终得到
// const _Vue = Vue

// return function render(_ctx, _cache) {
//     const { createElementVNode: _createElementVNode } = _Vue

//     return _createElementVNode("div", [], [" hello world "])
// }

// 上下文的code
// context.code = `
//   const _Vue = Vue \n\n return function render(_ctx, _cache) { \n\n const { createElementVNode: _createElementVNode } = _Vue \n\n return _createElementVNode("div", [], [" hello world "]) \n\n }
// `

// 格式化context.code后
// context.code = `
//   const _Vue = Vue

//   return function render(_ctx, _cache) {
//     const { createElementVNode: _createElementVNode } = _Vue
//     return _createElementVNode("div", [], [" hello world "])
//   }
// `

// 我们把上面的函数分成 4 个部分：
// 1.函数的前置代码：const _Vue = Vue
// 2.函数名：function render
// 3.函数的参数：_ctx, _cache
// 4.函数体：
// const { createElementVNode: _createElementVNode } = _Vue
// return _createElementVNode("div", [], [" hello world "])

/**
 * 根据 javascript AST 生成 render 函数
 */
export function generate(ast) {
  // 生成上下文 context
  const context = createCodegenContext(ast)

  // 获取 code 拼接方法
  const { push, newline, indent, deindent } = context

  // 1.生成函数前置代码：
  // const _Vue = Vue
  // return
  genFunctionPreamble(context)

  // 2.创建方法名称 function render
  const functionName = `render`
  // 3.创建方法参数 _ctx, _cache
  const args = ['_ctx', '_cache']
  // 拼接字符串为 _ctx, _cache
  const signature = args.join(', ')

  // 利用方法名称和参数拼接函数声明
  // function render(_ctx, _cache) {
  push(`function ${functionName}(${signature}) {`)

  // 缩进 + 换行
  indent()

  // 4.函数体：
  // 明确使用到的方法。如: [createVNode, ...]
  // const { createElementVNode: _createElementVNode } = _Vue
  const hasHelpers = ast.helpers.length > 0
  if (hasHelpers) {
    push(`const { ${ast.helpers.map(aliasHelper).join(', ')} } = _Vue`)
    // 换行
    push(`\n`)
    newline()
  }

  // return _createElementVNode("div", [], [" hello world "])
  newline()
  push(`return `)

  // 处理 return 结果。如：_createElementVNode("div", [], [" hello world "])
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context)
  } else {
    push(`null`)
  }

  // 收缩缩进 + 换行
  deindent()
  push(`}`)

  return {
    ast,
    code: context.code
  }
}

/**
 * 创建 generate 上下文对象
 */
function createCodegenContext(ast) {
  const context = {
    // render 函数代码字符串
    code: ``,
    // 运行时全局的变量名
    runtimeGlobalName: 'Vue',
    // 模板源
    source: ast.loc.source,
    // 缩进级别
    indentLevel: 0,
    isSSR: false,
    // 需要触发的方法，关联 JavaScript AST 中的 helpers
    helper(key) {
      return `_${helperNameMap[key]}`
    },
    /**
     * 插入代码
     */
    push(code) {
      context.code += code
    },
    /**
     * 新的一行
     */
    newline() {
      newline(context.indentLevel)
    },
    /**
     * 控制缩进的进 + 换行
     */
    indent() {
      newline(++context.indentLevel)
    },
    /**
     * 控制缩进的缩 + 换行
     */
    deindent() {
      newline(--context.indentLevel)
    }
  }

  function newline(n: number) {
    // '\n  '.length => 3
    context.code += '\n' + `  `.repeat(n)
  }

  return context
}

/**
 * 生成前置代码
 * "const _Vue = Vue\n\nreturn "
 */
function genFunctionPreamble(context) {
  const { push, runtimeGlobalName, newline } = context

  const VueBinding = runtimeGlobalName

  // 生成函数前置代码：const _Vue = Vue
  push(`const _Vue = ${VueBinding}\n`) // \n 换行
  // 再换行
  newline()
  push(`return `)
}

/**
 * 处理genNode
 * _createElementVNode("div", [], [" hello world "])
 */
function genNode(node, context) {
  switch (node.type) {
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context)
      break
    case NodeTypes.TEXT:
      genText(node, context)
      break
    default:
      break
  }
}

/**
 * 处理 VNode_CALL 节点
 */
function genVNodeCall(node, context) {
  const { push, helper } = context
  const { tag, props, children, patchFlag, dynamicProps, isComponent } = node

  // 返回 vnode 生成函数 （createElementVNode）
  const callHelper = getVNodeHelper(context.isSSR, isComponent)
  // _createElementVNode(
  push(helper(callHelper) + `(`)
  // 获取函数参数、剔除无效参数
  // ["/div/", [], [{content: " hello world ", type: 2}]]
  const args = genNullableArgs([tag, props, children, patchFlag, dynamicProps])
  // 处理参数的填充
  genNodeList(args, context)
  // 闭合)
  push(`)`)
}

/**
 * 处理 Text 节点
 */
function genText(node, context) {
  context.push(JSON.stringify(node.content))
}

/**
 * 处理 createXXXVNode 函数参数
 * 把有效的参数整理出来，把无效的剔除
 * @param args
 * @returns
 */
function genNullableArgs(args: any[]) {
  let i = args.length

  // 从后向前遍历
  while (i--) {
    // undefined == null => true
    if (args[i] != null) break
  }

  // 拿到有效参数
  return args.slice(0, i + 1).map(arg => arg || `null`)
}

/**
 * 处理参数的填充
 */
function genNodeList(nodes, context) {
  const { push } = context

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isString(node)) {
      // 字符串，字符串直接 push 即可
      push(node)
    } else if (isArray(node)) {
      // 数组 需要 push "[" "]"
      genNodeListAsArray(node, context)
    } else {
      // 对象
      // 需要区分 node 节点类型 递归处理
      // {content: " hello world ", type: 2}
      // 其实进入genNode又是处理Text类型
      genNode(node, context)
    }
    // 换行
    if (i < nodes.length - 1) {
      // 非最后一个
      push(`, `)
    }
  }
}

/**
 * 处理数组类型，其实又是递归genNodeList
 * @param nodes
 * @param context
 */
function genNodeListAsArray(nodes, context) {
  context.push(`[`)
  genNodeList(nodes, context)
  context.push(`]`)
}
