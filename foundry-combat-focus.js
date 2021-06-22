const MODULE_NAME = 'foundry-combat-focus'
const DISPLAY_NAME = 'Combat Focus'
const CHAT_ON_COMBAT_TRACKER_SETTING = 'showChatOnCombatTrackerTab'
const CHAT_INPUT_IN_SPLIT_VIEW = 'showChatInputInSplitView'
const CHAT_HEIGHT_SETTING = 'chatHeight'
const SMALL_CHAT_CLASS = 'small-chat'
const HIDE_CHAT_INPUT_CLASS = 'hide-chat-input'
const CHAT_ID = 'chat'
const COMBAT_ID = 'combat'
const ACTIVE_CLASS = 'active'
const STYLE_ID = `${MODULE_NAME}-styles`
const DRAG_AREA_HEIGHT = 8

function isChatOnCombatTrackerEnabled() {
  return game.settings.get(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING)
}

function isChatInputOnCombatTrackerEnabled() {
  return game.settings.get(MODULE_NAME, CHAT_INPUT_IN_SPLIT_VIEW)
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
          flex-grow: 0 !important;
          flex-shrink: 0 !important;
          flex-basis: ${chatHeight}px !important;
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
    chatElement.classList.add(ACTIVE_CLASS, SMALL_CHAT_CLASS)
    scrollChatToEnd()
  } else if (activeTab !== CHAT_ID) {
    chatElement.classList.remove(ACTIVE_CLASS)
  } else if (activeTab !== COMBAT_ID) {
    chatElement.classList.remove(SMALL_CHAT_CLASS)
  }

  if (!isChatInputOnCombatTrackerEnabled() && activeTab === COMBAT_ID) {
    chatElement.classList.add(HIDE_CHAT_INPUT_CLASS)
  } else {
    chatElement.classList.remove(HIDE_CHAT_INPUT_CLASS)
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

  game.settings.register(MODULE_NAME, CHAT_INPUT_IN_SPLIT_VIEW, {
    name: 'Show chat input on combat tracker tab',
    hint: 'Displays the chat input box below the chat log (as normal) on the combat tracker tab. Only takes effect ' +
      'when the above option is enabled.',
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

function isInDragArea(chatElement, event) {
  return event.target === chatElement && event.offsetY < DRAG_AREA_HEIGHT
}

let resizing = false

function onStartDrag(chatElement, event) {
  if (isInDragArea(chatElement, event)) {
    resizing = true
  }
}

function onDrag(event) {
  if (resizing) {
    const chatElement = getChatElement()
    const newHeight = chatElement.offsetHeight - event.movementY
    game.settings.set(MODULE_NAME, CHAT_HEIGHT_SETTING, newHeight)
    updateStyleElement()
  }
}

function onStopDrag() {
  if (resizing) {
    resizing = false
  }
}

let dragStartRegistered = false

function registerDragStartListener() {
  if (dragStartRegistered) {
    return
  }

  const chatElement = getChatElement()
  if (chatElement.tagName !== 'TEMPLATE') {
    chatElement.addEventListener('pointerdown', onStartDrag.bind(this, chatElement))
    dragStartRegistered = true
    console.log(`[${DISPLAY_NAME}] Drag start listener registered`)
  } else {
    console.debug(`[${DISPLAY_NAME}] Skipping to register chat drag handler because the chat isn't rendered yet.`)
  }
}

function registerDragResizeListener() {
  registerDragStartListener()
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

Hooks.on('renderSidebarTab', function() {
  registerDragStartListener()
})
