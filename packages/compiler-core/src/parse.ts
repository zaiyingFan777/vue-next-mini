import { ElementTypes, NodeTypes } from './ast'

/**
 * 标签类型，包含：开始和结束
 */
const enum TagType {
  Start,
  End
}

/**
 * 解析器上下文
 */
export interface ParserContext {
  // 模板数据源
  source: string
}

/**
 * 创建解析器上下文
 */
function createParserContext(content: string): ParserContext {
  // 合成 context 上下文对象
  return {
    source: content
  }
}

/**
 * 创建 ast 的根节点
 */
export function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc: {}
  }
}

/**
 * 基础的 parse 方法，生成 AST
 * 生成 ast 对象
 * 1.构建 parse 方法，生成 context 实例
 * 2.构建 parseChildren ，处理所有子节点（最复杂）
 * 2.1构建有限自动状态机解析模板
 * 2.2扫描 token 生成 AST 结构
 * 3.生成 AST，构建测试
 * @param content tempalte 模板
 * @returns
 */
export function baseParse(content: string) {
  // 1.创建 parser 对象，为解析器的上下的上下文对象
  const context = createParserContext(content)
  console.log(context, '上下文对象')

  // 2.构建 parseChildren方法，处理所有的子节点
  const children = parseChildren(context, [])
  console.log(children, '构建好的children的ast')

  // 3.生成 AST
  return createRoot(children)
}

/**
 * 解析子节点
 * @param context 上下文对象
 * @param mode 文本模型
 * @param ancestors 祖先节点
 * @returns
 */
function parseChildren(context: ParserContext, ancestors) {
  // 存放所有的 node 节点数据的数组
  const nodes = []

  /**
   * 循环解析所有 node 节点，可以理解为对 token 的处理。
   * 例如：<div>hello world</div>，此时的处理顺序为：
   * 1.<div
   * 2.>
   * 3.hello world
   * 4.</
   * 5.div>
   * 解析 template 模板
   * 当前不为结束标签
   */
  while (!isEnd(context, ancestors)) {
    const s = context.source

    let node

    if (startsWith(s, '{{')) {
      // 模板语法 {{ state }}
      node = parseInterpolation(context)
    }
    // < 意味着一个标签的开始
    else if (s[0] === '<') {
      // 以 < 开始，后面跟 a-z，表示，这是一个标签的开始
      if (/[a-z]/i.test(s[1])) {
        // 此时要处理 Element
        // 标签的开始 <div，因此这里要处理标签
        node = parseElement(context, ancestors)
      }
    }

    // node不存在意味着上面的两个 if 都没有进入，那么我们就认为此时的 token 为文本节点
    if (!node) {
      // 当前s不为模板语法、标签的开始，此时node只可能为文本节点
      // hello world</div>
      node = parseText(context)
    }

    // 将处理好的 node 放到 nodes里
    pushNode(nodes, node)
  }

  return nodes
}

/**
 * 解析插值表达式 {{ xxx }}
 */
function parseInterpolation(context: ParserContext) {
  // open = {{
  // close = }}
  const [open, close] = ['{{', '}}']

  // 移动游标，跳过{{
  advanceBy(context, open.length)

  // 获取插值表达式中间的值
  const closeIndex = context.source.indexOf(close, open.length)
  // " msg "
  const preTrimContent = parseTextData(context, closeIndex)
  // "msg"
  const content = preTrimContent.trim()

  // 移动游标，跳过}}
  advanceBy(context, close.length)

  // 插值里面包了层 简单表达式(SIMPLE_EXPRESSION)
  return {
    type: NodeTypes.INTERPOLATION, // 5
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION, // 4
      isStatic: false,
      content
    }
  }
}

/**
 * 解析 Element 元素。例如：<div>
 */
function parseElement(context: ParserContext, ancestors) {
  // -- 先处理开始标签 --
  // 1.解析 element 的开始标签
  const element = parseTag(context, TagType.Start)

  // -- 处理子节点 --
  // <div>hello world</div>
  // 上面处理好了<div>开始标签，然后将处理的结果：
  // {
  //   type: 1,
  //   tag: 'div',
  //   tagType: 0,
  //   props: [],
  //   children: []
  // } 放到 ancestors数组中，然后接着处理 hello world
  ancestors.push(element)
  // 2.处理children(hello world)
  // !!!递归触发 parseChildren
  const children = parseChildren(context, ancestors)
  // 递归下降算法（ancestors就为栈，比如<div>hello world</div> 他先存的就是<div>相关信息，这层处理完毕后，再弹出div）
  // 栈：[root, div] 处理 hello world ，处理结束后，将div标签，从ancestors中移除
  // 处理完children，将<div>父级标签，从ancestors中移除
  ancestors.pop()

  // 为了子节点赋值
  element.children = children

  // -- 最后处理结束标签 --
  // 3.hello world 处理完判断是否为结束标签
  if (startsWithEndTagOpen(context.source, element.tag)) {
    // 如果是结束标签的开始 </div>
    // 处理</div>
    parseTag(context, TagType.End)
  }

  return element
}

/**
 * 处理 element 标签（解析标签）、属性、v-xx等指令
 * @param context 上下文对象
 * @param type
 */
function parseTag(context: ParserContext, type: TagType): any {
  // -- 处理标签开始部分 ——-

  // 1.解析标签（通过正则获取标签名）
  // /^<\/?([a-z][^\r\n\t\f />]*)/i.exec('<div>hello world</div>')
  // => ["<div", "div", groups: undefined, index: 0, input: "<div>hello world</div>"]
  const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source)
  // 标签名字 div
  const tag = match[1]

  // 2.移动游标（对模板进行解析处理）
  // match[0]: <div
  // match[0].length(4)，'<div>hello world</div>'.slice(4) => '>hello world</div>'
  advanceBy(context, match[0].length)

  // 2-3之间，解析属性、指令
  // 处理div 到 v-if 中间的空格
  advanceSpaces(context)
  // 进行属性（包含 attr + props）解析
  let props = parseAttributes(context, type)

  // -- 处理标签结束部分 --
  // 3.判断是否为自闭和标签 例如：<img/>
  // <div> 处理 >
  // '>hello world</div>'.slice(1) => 'hello world</div>'
  let isSelefClosing = startsWith(context.source, '/>')
  // 《继续》对模板进行解析处理，是自动标签则处理两个字符 />，不是则处理一个字符 >
  // 如果是自闭和标签，则右移2位，如果非自闭和标签，则右移1位
  advanceBy(context, isSelefClosing ? 2 : 1)

  // 1、2、3 总结：从'<div>hello world</div>' => 'hello world</div>'

  // 标签类型
  let tagType = ElementTypes.ELEMENT

  return {
    // 节点类型
    // type: 1
    type: NodeTypes.ELEMENT,
    // tag: 'div'
    tag,
    // Element标签类型: 0
    tagType,
    // 属性，目前我们没有做任何处理。但是需要添加上，否则，生成的 ast 放到 vue 源码中会抛出错误
    props
    // ????
    // children: []
  }
}

/**
 * type: 0开始标签、1结束标签
 * 进行属性（包含 attr + props）解析
 */
function parseAttributes(context: ParserContext, type) {
  // 解析之后的 props 数组
  const props: any = []
  // 属性名数组
  const attributeNames = new Set<string>()

  // 循环解析，直到解析到标签结束（'>' || '/>'）为止
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    // 具体某一条属性的处理
    const attr = parseAttribute(context, attributeNames)
    // 添加属性
    if (type === TagType.Start) {
      props.push(attr)
    }
    advanceSpaces(context)
  }
  return props
}

/**
 * 处理指定指令，返回指令节点
 */
function parseAttribute(context: ParserContext, nameSet: Set<string>) {
  // 获取属性名称。例如：v-if
  // /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec('v-if="isshow"' || "class='test'") =>
  // ['v-if', index: 0, input: 'v-if="isshow"', groups: undefined]
  // ['class', index: 0, input: "class='test'", groups: undefined
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  // v-if
  const name = match[0]
  // 添加当前的处理属性
  nameSet.add(name)

  // "v-if='isShow' ..." => "='isShow' ..."
  // 向右移动游标
  advanceBy(context, name.length)

  // 获取属性值
  let value: any = undefined

  // 解析模板，并拿到对应的属性值节点
  // /^[\t\r\n\f ]*=/.test("='isShow'" || "='test'") => true
  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    // 移除空格
    advanceSpaces(context)
    // 移动等号 "='isShow'" => "'isShow'"
    advanceBy(context, 1)
    // 移除空格
    advanceSpaces(context)
    // value =>
    // {
    //   content: isShow,
    //   isQuoted: true,
    //   loc: {}
    // }
    value = parseAttributeValue(context)
  }

  // 针对 v- 的指令处理
  // /^(v-[A-Za-z0-9-]|:|\.|@|#)/.test("v-if") => true
  // /^(v-[A-Za-z0-9-]|:|\.|@|#)/.test("class") => false
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    // 获取指令名称
    // /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec("v-if") =>
    // ['v-if', 'if', undefined, undefined, index: 0, input: 'v-if', groups: undefined]
    const match =
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name
      )!
    // 指令名。v-if 则获取 if
    let dirName = match[1]

    // TODO：指令参数 v-bind:arg
    // /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec("v-bind:arg") =>
    // ['v-bind:arg', 'bind', 'arg', undefined, index: 0, input: 'v-bind:arg', groups: undefined]
    // let arg: any

    // /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec("v-on::click.modifiers") =>
    // ['v-on::click.modifiers', 'on', ':click', '.modifiers', index: 0, input: 'v-on::click.modifiers', groups: undefined]
    // TODO：指令修饰符 v-on::click.modifiers
    // const modifiers = match[3] ? match[3].slice(1).split('.') : []

    // 放在ast节点的 props 属性中
    return {
      type: NodeTypes.DIRECTIVE, // 7
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION, // 4
        content: value.content, // "isShow" // 值
        isStatic: false,
        loc: value.loc
      },
      arg: undefined,
      modifiers: undefined,
      loc: {}
    }
  }

  // 如果不是指令 是属性
  return {
    type: NodeTypes.ATTRIBUTE, // 6
    name,
    value: value && {
      type: NodeTypes.TEXT, // 3
      content: value.content, // "isShow"
      loc: value.loc
    },
    loc: {}
  }
}

/**
 * 获取属性（attr）的 value
 */
function parseAttributeValue(context: ParserContext) {
  let content = ''

  // 判断是单引号还是双引号
  const quote = context.source[0]
  // 双引号、单引号长度都为1
  const isQuoted = quote === `"` || quote === `'`

  // 引号处理
  if (isQuoted) {
    // 双引号
    advanceBy(context, 1)
    // 获取结束"的 index
    const endIndex = context.source.indexOf(quote)
    if (endIndex === -1) {
      content = parseTextData(context, context.source.length)
    } else {
      // `isShow">...`
      // 解析出来isShow 得到">
      content = parseTextData(context, endIndex)
      // 再移动一位 得到 >
      advanceBy(context, 1)
    }
  }

  return {
    content, // isShow
    isQuoted,
    loc: {}
  }
}

/**
 * 解析文本
 * @param context
 * @returns
 */
function parseText(context: ParserContext) {
  /**
   * 定义普通文本结束的标记
   * 例如：hello world</div>，那么文本结束的标记就是 <
   * ps: 这也意味着如果你渲染了一个 <div>hel<o</div>的标签，那么你将得到一个错误
   */
  // 白名单（普通文本的结束，如果我们的文本遇到<或者{{就会结束）
  const endTokens = ['<', '{{']

  // hello world</div> 这里肯定不准确，拿到的endIndex，因此需要我们修正
  // endIndex: 17
  // 最终得到普通文本结束的下标
  let endIndex = context.source.length

  // 计算精准的 endIndex，计算的逻辑为：从 context.source 中分别获取'<'，'{{'的下标，取最小值为 endIndex
  for (let i = 0; i < endTokens.length; i++) {
    // 从索引1开始（跳过索引为0的元素）向后搜索第一个<或者{{
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      // 修正 endIndex hello world</div> => 11
      endIndex = index
    }
  }

  // 截取文本，并移动游标到</div>
  const content = parseTextData(context, endIndex)

  // hello world
  return {
    type: NodeTypes.TEXT,
    content
  }
}

/**
 * 从指定位置（length）获取给定长度的文本数据。
 * length: endIndex
 * hello world</div>.slice(0, 11) => hello world
 * @param context
 * @param length
 * @returns
 */
function parseTextData(context: ParserContext, length: number) {
  // 获取指定的文本数据
  const rawText = context.source.slice(0, length)

  // 《继续》对模板进行解析处理
  // 继续游标右移动 => 'hello world</div>'.slice(11) => '</div>'
  advanceBy(context, length)
  // 返回获取到的文本
  return rawText
}

/**
 * 前进非固定步骤  处理 div v-if 中间的空格
 * var match = /^[\t\r\n\f ]+/.exec("  v-")
 * =>
 * [' ', index: 0, input: ' v-', groups: undefined]
 * match[0].length为2
 */
function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

/**
 * nodes.push(node)
 * @param nodes
 * @param node
 */
function pushNode(nodes, node) {
  nodes.push(node)
}

/**
 * 判断当前的标签是否是结束标签，如果不是结束标签返回false，是结束标签返回true
 * 判断是否为结束节点
 * @param context 上下文
 * @param ancestors 祖先节点
 */
function isEnd(context: ParserContext, ancestors) {
  // <div>hello world</div>
  const s = context.source

  // 解析是否为结束标签
  if (startsWith(s, '</')) {
    // 当前是结束标签
    // 比如<div>hello world</div> 解析到</div>
    // 这时候ancestors栈：[{children: [], props: [], tag: "div", tagType: 0, type: 1}] 我们去栈里找 是否能匹配到开头的<div>找到了说明
    // 我们处理了这一轮的标签<div>hello world</div>
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        // 当前为结束标签的开始：</
        return true
      }
    }
  }

  // !'xxx' => false
  return !s
}

/**
 * 判断当前是否为《标签结束的开始》。比如 </div> 就是 div 标签结束的开始
 * @param source 模板。例如：</div>
 * @param tag 标签。例如：div
 * @returns
 */
function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    // <div></div>
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

/**
 * 是否以指定文本开头
 */
function startsWith(source: string, searchStr: string): boolean {
  return source.startsWith(searchStr)
}

/**
 * 游标右移
 * 前进一步。多次调用，每次调用都会处理一部分的模板内容
 * 以 <div>hello world</div> 为例
 * 1. <div
 * 2. >
 * 3. hello world
 * 4. </div
 * 5. >
 * @param context
 * @param num
 */
function advanceBy(context: ParserContext, numberOfCharacters: number) {
  // template 模板源
  const { source } = context
  // 去除开始部分的无效数据
  // source: <div>hello world</div>，numberOfCharacters: 4
  // >hello world</div>
  context.source = source.slice(numberOfCharacters)
}
