const MODULE_NAME = 'foundry-combat-focus'
const CHAT_ON_COMBAT_TRACKER_SETTING = 'showChatOnCombatTrackerTab'
const CHAT_HEIGHT_SETTING = 'chatHeight'
const SMALL_CHAT_CLASS = 'small-chat'
const CHAT_ID = 'chat'
const COMBAT_ID = 'combat'
const ACTIVE_CLASS = 'active'
const STYLE_ID = `${MODULE_NAME}-styles`
const DRAG_AREA_HEIGHT = 8

function isChatOnCombatTrackerEnabled() {
  return game.settings.get(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING)
}

/**
 * @returns {null|string}
 */
function getActiveTab() {
  if (ui.sidebar != null) {
    return ui.sidebar.activeTab
  } else {
    return null
  }
}

function getChatElement() {
  return document.getElementById(CHAT_ID)
}

function getChatLog() {
  return document.getElementById('chat-log')
}

function isScrolledToBottom() {
  const chatLog = getChatLog()
  if (chatLog != null) {
    return chatLog.scrollHeight - chatLog.offsetHeight === chatLog.scrollTop
  } else {
    return false
  }
}

function scrollChatToEnd() {
  const chatLog = getChatLog()
  if (chatLog != null && typeof chatLog.scrollTo === 'function') {
    chatLog.scrollTo({ top: chatLog.scrollHeight - chatLog.offsetHeight })
  }
}

function createStyleElement() {
  const style = document.createElement('style')
  style.setAttribute('id', STYLE_ID)
  document.head.append(style)
  return style
}

function updateStyleElement() {
  const chatHeight = game.settings.get(MODULE_NAME, CHAT_HEIGHT_SETTING)
  if (chatHeight != null && chatHeight !== 0) {
    const scrolledToBottom = isScrolledToBottom()
    const style = document.getElementById(STYLE_ID)
    if (style != null) {
      style.innerText = `
        #${CHAT_ID}.${SMALL_CHAT_CLASS} { 
          flex-grow: 0;
          flex-basis: ${chatHeight}px;
        }
      `
      if (scrolledToBottom) {
        requestAnimationFrame(() => scrollChatToEnd())
      }
    }
  }
}

function updateCombatTrackerStyle() {
  const enable = isChatOnCombatTrackerEnabled()
  const activeTab = getActiveTab()
  const chatElement = getChatElement()
  if (enable && activeTab === COMBAT_ID) {
    chatElement.classList.add(ACTIVE_CLASS)
    chatElement.classList.add(SMALL_CHAT_CLASS)
    scrollChatToEnd()
  } else if (activeTab !== CHAT_ID) {
    chatElement.classList.remove(ACTIVE_CLASS)
  } else if (activeTab !== COMBAT_ID) {
    chatElement.classList.remove(SMALL_CHAT_CLASS)
  }
}

function registerSettings() {
  game.settings.register(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING, {
    name: 'Show chat on combat tracker tab',
    hint: 'Displays the chat log below the combat tracker',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: updateCombatTrackerStyle
  })

  game.settings.register(MODULE_NAME, CHAT_HEIGHT_SETTING, {
    name: 'Chat height',
    hint: 'Changes the chat window height when displaying it below the combat tracker',
    scope: 'client',
    config: false,  //< Non-UI setting. Adjusted via drag and drop.
    type: Number,
    default: null,
  })
}

function injectSidebarHook() {
  const sidebar = ui.sidebar._tabs[0]
  const originalMethod = sidebar.activate
  sidebar.activate = function activateOverride(name, ...rest) {
    originalMethod.call(this, name, ...rest)
    updateCombatTrackerStyle()
  }
}

function isInDragArea(event) {
  return event.offsetY < DRAG_AREA_HEIGHT
}

let resizing = false

function onStartDrag(event) {
  if (isInDragArea(event)) {
    resizing = true
  }
}

function onDrag(event) {
  if (resizing) {
    const chatElement = getChatElement()
    game.settings.set(MODULE_NAME, CHAT_HEIGHT_SETTING, chatElement.offsetHeight - event.movementY)
    updateStyleElement()
  }
}

function onStopDrag() {
  if (resizing) {
    resizing = false
  }
}

function registerDragResizeListener() {
  const chatElement = getChatElement()
  chatElement.addEventListener('pointerdown', onStartDrag)
  document.addEventListener('pointermove', onDrag)
  document.addEventListener('pointerup', onStopDrag)
  document.addEventListener('pointercancel', onStopDrag)
}

Hooks.on('init', () => {
  createStyleElement()
  registerSettings()
})

Hooks.on('ready', () => {
  injectSidebarHook()
  registerDragResizeListener()
  updateCombatTrackerStyle()
  updateStyleElement()
})
