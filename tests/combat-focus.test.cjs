const {test} = require('node:test')
const assert = require('node:assert/strict')
const {readFileSync} = require('node:fs')
const vm = require('node:vm')

const source = readFileSync(require.resolve('../foundry-combat-focus.js'), 'utf8')
const MODULE = 'foundry-combat-focus'

function element() {
  const classes = new Set()
  const properties = new Map()
  return {
    children: [], listeners: {}, attributes: {}, clientHeight: 800, offsetHeight: 400,
    classList: {
      contains: name => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
    },
    style: {setProperty: (k, v) => properties.set(k, v), removeProperty: k => properties.delete(k),
      getPropertyValue: k => properties.get(k)},
    getBoundingClientRect: () => ({height: 800}),
    querySelector() { return this.children.find(c => c.className === 'combat-focus-resize') },
    prepend(child) { this.children.unshift(child) },
    setAttribute(k, v) { this.attributes[k] = v },
    addEventListener(k, fn) { this.listeners[k] = fn },
    setPointerCapture(id) { this.capture = id },
    hasPointerCapture(id) { return this.capture === id },
    releasePointerCapture() { this.capture = null }
  }
}

function setup() {
  const content = element()
  const callbacks = new Map()
  const settings = new Map()
  const writes = []
  const frames = []
  class NativeChat {
    constructor() {
      this.element = element()
      this.element.parentElement = content
      this.rendered = true
      this.options = {}
      this.isAtBottom = false
      this.refreshes = 0
    }
    _shouldShowNotifications(options) { this.policyOptions = options; return true }
    _toggleNotifications() { this.refreshes++; this.notifications = this._shouldShowNotifications() }
    scrollBottom() { this.scrolled = true }
    processMessage() { return 'native message processing' }
  }
  const context = vm.createContext({
    console, CONFIG: {ui: {chat: NativeChat}},
    ResizeObserver: class { observe() {} disconnect() {} },
    document: {getElementById: () => content, createElement: () => element()},
    game: {settings: {
      register(namespace, key, config) { assert.equal(namespace, MODULE); settings.set(key, {...config, value: config.default}) },
      get(namespace, key) { assert.equal(namespace, MODULE); return settings.get(key).value },
      set(namespace, key, value) {
        writes.push({key, value}); settings.get(key).value = value
        settings.get(key).onChange?.(value)
        return Promise.resolve(value)
      }
    }},
    ui: {sidebar: {tabGroups: {primary: 'combat'}, expanded: true}, combat: {element: {parentElement: content}}},
    Hooks: {once: (k, f) => callbacks.set(k, f), on: (k, f) => callbacks.set(k, f)},
    requestAnimationFrame: callback => frames.push(callback)
  })
  vm.runInContext(source, context)
  callbacks.get('init')()
  context.ui.chat = new context.CONFIG.ui.chat()
  function flush() { while (frames.length) frames.shift()() }
  return {context, content, settings, writes, callbacks, flush, NativeChat}
}

test('extends the configured ChatLog and retains native behavior and settings keys', () => {
  const {context, NativeChat, settings} = setup()
  assert.ok(context.ui.chat instanceof NativeChat)
  assert.equal(context.ui.chat.processMessage(), 'native message processing')
  assert.deepEqual([...settings.keys()], ['showChatOnCombatTrackerTab', 'showChatInputInSplitView', 'chatHeight'])
  assert.ok([...settings.values()].every(s => s.scope === 'client'))
})

test('notification policy only changes for the visible docked split', () => {
  const {context, settings} = setup()
  const {ui} = context
  assert.equal(ui.chat._shouldShowNotifications(), false)
  for (const change of [
    () => { ui.sidebar.expanded = false },
    () => { ui.sidebar.expanded = true; ui.sidebar.tabGroups.primary = 'actors' },
    () => { ui.sidebar.tabGroups.primary = 'combat'; ui.chat.popout = {rendered: true} },
    () => { ui.chat.popout = null; ui.chat.options.stream = true },
    () => { ui.chat.options.stream = false; settings.get('showChatOnCombatTrackerTab').value = false }
  ]) {
    change()
    const options = {closing: true}
    assert.equal(ui.chat._shouldShowNotifications(options), true)
    assert.equal(ui.chat.policyOptions, options)
  }
})

test('hooks coalesce, use one handle and do not refocus chat on combat rerenders', () => {
  const {context, content, callbacks, flush} = setup()
  callbacks.get('ready')(); callbacks.get('renderChatLog')(); flush()
  assert.equal(content.classList.contains('combat-focus-split'), true)
  assert.equal(context.ui.chat.refreshes, 1)
  callbacks.get('renderCombatTracker')(); flush()
  assert.equal(context.ui.chat.element.children.length, 1)
  assert.equal(context.ui.chat.refreshes, 1)
  context.ui.sidebar.tabGroups.primary = 'actors'
  callbacks.get('changeSidebarTab')(); flush()
  assert.equal(content.classList.contains('combat-focus-split'), false)
  assert.equal(context.ui.chat.refreshes, 2)
})

test('missing sidebar DOM during startup does not activate the split', () => {
  const {context} = setup()
  context.document.getElementById = () => null
  context.ui.chat.element.parentElement = null
  context.ui.combat.element.parentElement = null
  assert.equal(context.isSplitVisible(), false)
  assert.doesNotThrow(() => context.updateLayout())
})

test('disabling split clears input hiding; invalid saved heights reset to CSS default', () => {
  const {context, content, settings} = setup()
  settings.get('showChatInputInSplitView').value = false
  settings.get('chatHeight').value = 340
  context.updateLayout()
  assert.equal(content.classList.contains('combat-focus-hide-input'), true)
  assert.equal(content.style.getPropertyValue('--combat-focus-chat-height'), '340px')
  settings.get('showChatOnCombatTrackerTab').value = false
  settings.get('chatHeight').value = -1
  context.updateLayout()
  assert.equal(content.classList.contains('combat-focus-hide-input'), false)
  assert.equal(content.style.getPropertyValue('--combat-focus-chat-height'), undefined)
})

test('resize previews use scaled coordinates and persist only on pointer release', () => {
  const {context, content, writes} = setup()
  content.getBoundingClientRect = () => ({height: 1600})
  context.updateLayout()
  const handle = context.ui.chat.element.children[0]
  handle.listeners.pointerdown({button: 0, pointerId: 1, clientY: 500, preventDefault() {}})
  handle.listeners.pointermove({pointerId: 1, clientY: 400})
  assert.equal(content.style.getPropertyValue('--combat-focus-chat-height'), '450px')
  assert.equal(writes.length, 0)
  context.ui.chat.element.offsetHeight = 450
  handle.listeners.pointerup({pointerId: 1})
  assert.equal(writes.length, 1)
  assert.equal(writes[0].value, 450)
})

test('resize bounds use layout pixels and adapt to short viewports', () => {
  const {context, content} = setup()
  content.getBoundingClientRect = () => ({height: 1600})
  assert.equal(context.setHeight(9999), 620)
  assert.equal(context.setHeight(-100), 160)
  content.clientHeight = 200
  assert.equal(context.setHeight(9999), 120)
  assert.equal(context.setHeight(-100), 80)
})

test('cancelled drag restores saved size; keyboard reset clears it', () => {
  const {context, content, settings, writes} = setup()
  settings.get('chatHeight').value = 300
  context.updateLayout()
  const handle = context.ui.chat.element.children[0]
  handle.listeners.pointerdown({button: 0, pointerId: 1, clientY: 500, preventDefault() {}})
  handle.listeners.pointermove({pointerId: 1, clientY: 400})
  handle.listeners.pointercancel()
  assert.equal(writes.length, 0)
  assert.equal(content.style.getPropertyValue('--combat-focus-chat-height'), '300px')
  handle.listeners.keydown({key: 'Home', preventDefault() {}})
  assert.equal(writes[0].value, null)
  assert.equal(content.style.getPropertyValue('--combat-focus-chat-height'), undefined)
})
