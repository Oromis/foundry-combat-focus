const MODULE_NAME = 'foundry-combat-focus'
const SHOW_CHAT = 'showChatOnCombatTrackerTab'
const SHOW_INPUT = 'showChatInputInSplitView'
const CHAT_HEIGHT = 'chatHeight'
const SPLIT_CLASS = 'combat-focus-split'
const HIDE_INPUT_CLASS = 'combat-focus-hide-input'
const HEIGHT_PROPERTY = '--combat-focus-chat-height'
const HANDLE_CLASS = 'combat-focus-resize'

function getContent() {
  return document.getElementById('sidebar-content')
}

/** Only the docked native applications participate; popouts keep core behavior. */
function isSplitVisible() {
  const content = getContent()
  return Boolean(
    content &&
    game.settings.get(MODULE_NAME, SHOW_CHAT) &&
    !ui.chat?.options.stream &&
    ui.sidebar?.tabGroups.primary === 'combat' &&
    ui.sidebar.expanded &&
    !ui.chat?.popout?.rendered &&
    ui.chat?.element?.parentElement === content &&
    ui.combat?.element?.parentElement === content
  )
}

function applyHeight() {
  const content = getContent()
  if (!content) return
  const height = game.settings.get(MODULE_NAME, CHAT_HEIGHT)
  if (Number.isFinite(height) && height > 0) {
    content.style.setProperty(HEIGHT_PROPERTY, `${height}px`)
  } else {
    content.style.removeProperty(HEIGHT_PROPERTY)
  }
}

function scrollBottomIfNeeded(wasAtBottom) {
  if (wasAtBottom) requestAnimationFrame(() => ui.chat.scrollBottom())
}

function updateLayout() {
  const content = getContent()
  if (!content || !ui.chat?.rendered) return
  const wasAtBottom = ui.chat.isAtBottom
  const wasSplit = content.classList.contains(SPLIT_CLASS)
  const split = isSplitVisible()
  content.classList.toggle(SPLIT_CLASS, split)
  content.classList.toggle(HIDE_INPUT_CLASS,
    split && !game.settings.get(MODULE_NAME, SHOW_INPUT))
  applyHeight()
  installResizeHandle()

  // This core method moves the existing editor/controls and updates the hotbar.
  // The subclass below changes only the visibility decision it consults.
  if (split !== wasSplit) ui.chat._toggleNotifications()
  if (split !== wasSplit) scrollBottomIfNeeded(wasAtBottom)
}

let scheduled = false
function scheduleLayout() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    updateLayout()
  })
}

function registerSettings() {
  game.settings.register(MODULE_NAME, SHOW_CHAT, {
    name: 'Show chat on combat tracker tab',
    hint: 'Displays the native chat log below the combat tracker.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: scheduleLayout
  })
  game.settings.register(MODULE_NAME, SHOW_INPUT, {
    name: 'Show chat input on combat tracker tab',
    hint: 'Displays the native chat input below the chat log in split view.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: scheduleLayout
  })
  game.settings.register(MODULE_NAME, CHAT_HEIGHT, {
    name: 'Chat height',
    hint: 'Adjust by dragging the divider above the chat, or using its arrow keys.',
    scope: 'client', config: false, type: Number, default: null,
    onChange: () => {
      const wasAtBottom = ui.chat?.isAtBottom
      applyHeight()
      scrollBottomIfNeeded(wasAtBottom)
    }
  })
}

/**
 * Use the configured core/system ChatLog class, including its templates, message
 * rendering, event handlers, editor, history and popout implementation.
 * v14's protected policy is the sole behavior extension. Returning false lets
 * core dock its own input and controls and suppress duplicate notifications.
 */
function configureChat() {
  const BaseChatLog = CONFIG.ui.chat
  CONFIG.ui.chat = class CombatFocusChatLog extends BaseChatLog {
    _shouldShowNotifications(options = {}) {
      if (isSplitVisible()) return false
      return super._shouldShowNotifications(options)
    }
  }
}

function setHeight(height) {
  const content = getContent()
  const available = content.clientHeight
  // Bound both panes, including after shrinking the browser or changing UI scale.
  const minimum = Math.min(160, available * 0.4)
  const maximum = available - Math.min(180, available * 0.4)
  const clamped = Math.round(Math.max(minimum, Math.min(height, maximum)))
  content.style.setProperty(HEIGHT_PROPERTY, `${clamped}px`)
  return clamped
}

function persistHeight(height) {
  game.settings.set(MODULE_NAME, CHAT_HEIGHT, height).catch(error => {
    console.error('Combat Focus | Could not save chat height', error)
  })
}

let resizeObserver
function installResizeHandle() {
  const chat = ui.chat.element
  if (!chat || chat.querySelector(`:scope > .${HANDLE_CLASS}`)) return
  const handle = document.createElement('div')
  handle.className = HANDLE_CLASS
  handle.tabIndex = 0
  handle.setAttribute('role', 'separator')
  handle.setAttribute('aria-label', 'Resize combat tracker and chat')
  handle.setAttribute('aria-orientation', 'horizontal')
  handle.setAttribute('aria-controls', 'combat chat')
  handle.setAttribute('aria-valuemin', '0')
  handle.setAttribute('aria-valuemax', '100')
  handle.setAttribute('aria-valuenow', '50')
  handle.title = 'Drag to resize chat. Arrow keys resize; Home resets.'
  chat.prepend(handle)
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    if (!isSplitVisible()) return
    const percent = Math.round(chat.offsetHeight / getContent().clientHeight * 100)
    handle.setAttribute('aria-valuenow', `${percent}`)
    handle.setAttribute('aria-valuetext', `${percent}% chat`)
  })
  resizeObserver.observe(chat)

  let drag = null
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !isSplitVisible()) return
    event.preventDefault()
    const content = getContent()
    // Pointer coordinates are viewport pixels; layout dimensions follow UI scale.
    const scale = content.getBoundingClientRect().height / content.clientHeight
    drag = {id: event.pointerId, y: event.clientY, height: chat.offsetHeight, scale,
      wasAtBottom: ui.chat.isAtBottom}
    handle.setPointerCapture(event.pointerId)
  })
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return
    if (!isSplitVisible()) return cancelDrag()
    setHeight(drag.height - (event.clientY - drag.y) / drag.scale)
    scrollBottomIfNeeded(drag.wasAtBottom)
  })
  function cancelDrag() {
    if (!drag) return
    const {id} = drag
    drag = null
    applyHeight()
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id)
  }
  handle.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return
    const height = chat.offsetHeight
    drag = null
    handle.releasePointerCapture(event.pointerId)
    persistHeight(height)
  })
  handle.addEventListener('pointercancel', cancelDrag)
  handle.addEventListener('lostpointercapture', cancelDrag)
  handle.addEventListener('keydown', event => {
    if (!isSplitVisible()) return
    if (event.key === 'Home') {
      event.preventDefault()
      persistHeight(null)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const wasAtBottom = ui.chat.isAtBottom
      const step = event.shiftKey ? 50 : 10
      persistHeight(setHeight(chat.offsetHeight + (event.key === 'ArrowUp' ? step : -step)))
      scrollBottomIfNeeded(wasAtBottom)
    }
  })
}

Hooks.once('init', () => {
  registerSettings()
  configureChat()
})

// These hooks cover tab switches, collapse/expand, rerenders and popout lifecycle.
// Defer until core has completed its class/DOM changes for the current event.
for (const hook of ['ready', 'changeSidebarTab', 'collapseSidebar',
  'renderSidebar', 'renderChatLog', 'renderCombatTracker', 'closeChatLog']) {
  Hooks.on(hook, scheduleLayout)
}
