import { isArray, isString } from '@vue/shared'
import { NodeTypes } from './ast'
import { helperNameMap, TO_DISPLAY_STRING } from './runtimeHelpers'
import { getVNodeHelper } from './utils'

/**
 * 别名助手
 */
const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`

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

  // 3-4. 增加 with (_ctx) {
  // 增加 with 触发
  push(`with (_ctx) {`)
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

  // 3-4. with收尾
  deindent()
  push(`}`)

  // 收缩缩进 + 换行
  deindent()
  push(`}`)

  return {
    ast,
    code: context.code
  }
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
    // 嵌套节点 这里的h是外层div codegenNode下children的一个item，然后我们需要处理h1.codegenNode
    // children: [{…}]
    // codegenNode: {type: 13, tag: '"h"', props: Array(0), children: Array(1)}
    // props: []
    // tag: "h"
    // tagType: 0
    // type: 1
    case NodeTypes.ELEMENT:
    case NodeTypes.IF:
      genNode(node.codegenNode!, context)
      break
    // VNODE_CALL
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context)
      break
    // 文本
    case NodeTypes.TEXT:
      genText(node, context)
      break
    // 复合表达式
    // {
    //   type: NodeTypes.INTERPOLATION, // 5
    //   content: {
    //     type: NodeTypes.SIMPLE_EXPRESSION, // 4
    //     isStatic: false,
    //     content: "msg",
    //   }
    // }
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context)
      break
    // 表达式处理
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context)
      break
    // {{}} 处理
    // 需要新增的 JavaScript AST 结构
    // {
    //   "type": 8, // NodeTypes.COMPOUND_EXPRESSION
    //   "loc": {},
    //   "children": [
    //     {
    //       "type": 2, // NodeTypes.TEXT
    //       "content": " hello ",
    //       "loc": {}
    //     },
    //     " + ",
    //     {
    //       "type": 5, // NodeTypes.INTERPOLATION
    //       "content": {
    //         "type": 4, // NodeTypes.SIMPLE_EXPRESSION
    //         "isStatic": false,
    //         "constType": 0,
    //         "content": "msg",
    //         "loc": {}
    //       },
    //       "loc": {}
    //     }
    //   ]
    // }
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context)
      break
    // JS调用表达式的处理 注释 _createCommentVNode
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context)
      break
    // JS条件表达式的处理
    // if的codegenNode
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context)
      break
    default:
      break
  }
}

/**
 * JS调用表达式的处理
 * 生成注释???
 */
function genCallExpression(node, context) {
  const { push, helper } = context
  const callee = isString(node.callee) ? node.callee : helper(node.callee)

  push(callee + `(`, node)
  genNodeList(node.arguments, context)
  push(`)`)
}

/**
 * JS条件表达式的处理。
 * 例如：
 *  isShow
        ? _createElementVNode("h1", null, ["你好，世界"])
        : _createCommentVNode("v-if", true),
 */
function genConditionalExpression(node, context) {
  const { test, consequent, alternate, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    // 写入变量
    genExpression(test, context)
  }
  // 换行
  needNewline && indent()
  // 缩进++
  context.indentLevel++
  // 写入空格
  needNewline || push(` `)
  // 写入 ？
  push(`? `)
  // 写入满足条件的处理逻辑
  genNode(consequent, context)
  // 缩进 --
  context.indentLevel--
  // 换行
  needNewline && newline()
  // 写入空格
  needNewline || push(` `)
  // 写入:
  push(`: `)
  // 判断 else 的类型是否也为 JS_CONDITIONAL_EXPRESSION
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  // 不是则缩进++
  if (!isNested) {
    context.indentLevel++
  }
  // 写入 else （不满足条件）的处理逻辑
  genNode(alternate, context)
  // 缩进--
  if (!isNested) {
    context.indentLevel--
  }
  // 控制缩进 + 换行
  needNewline && deindent(true /* without newline */)
}

/**
 * 复合表达式处理
 * [" hello " + _toDisplayString(msg) + " "]
 */
function genCompoundExpression(node, context) {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (isString(child)) {
      context.push(child)
    } else {
      // 其他的都再去genNode里处理
      genNode(child, context)
    }
  }
}

/**
 * SIMPLE_EXPRESSION  {{ msg }} 中的 msg
* {
    "type": 5, // NodeTypes.INTERPOLATION
    "content": {
      "type": 4, // NodeTypes.SIMPLE_EXPRESSION
      "isStatic": false,
      "constType": 0,
      "content": "msg",
      "loc": {}
    },
    "loc": {}
  }
 */
function genExpression(node, context) {
  const { content, isStatic } = node
  context.push(isStatic ? JSON.stringify(content) : content, node)
}

/**
 * {{}} 处理
 */
function genInterpolation(node, context) {
  const { push, helper } = context

  // _toDisplayString(msg)
  push(`${helper(TO_DISPLAY_STRING)}(`)

  genNode(node.content, context)

  push(`)`)
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
