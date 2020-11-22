const MODULE_NAME = 'foundry-combat-focus'
const CHAT_ON_COMBAT_TRACKER_SETTING = 'showChatOnCombatTrackerTab'
const COMBAT_TRACKER_TO_CHAT_RATIO_SETTING = 'combatToChatRatio'
const CHAT_ID = 'chat'
const COMBAT_ID = 'combat'
const ACTIVE_CLASS = 'active'
const STYLE_ID = `${MODULE_NAME}-styles`

function isChatOnCombatTrackerEnabled() {
  return game.settings.get(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING)
}

function getActiveTab() {
  return ui.sidebar.activeTab
}

function getChatElement() {
  return document.getElementById(CHAT_ID)
}

function createStyleElement() {
  const style = document.createElement('style')
  style.setAttribute('id', STYLE_ID)
  document.head.append(style)
  return style
}

function getSizeRatio() {
  const setting = game.settings.get(MODULE_NAME, COMBAT_TRACKER_TO_CHAT_RATIO_SETTING) || '1:1'
  const parts = setting.split(':')
  return {
    combat: parseFloat(parts[0] || '1'),
    chat: parseFloat(parts[1] || '1'),
  }
}

function updateStyleElement() {
  const style = document.getElementById(STYLE_ID)
  const { combat, chat } = getSizeRatio()
  if (style != null) {
    style.innerText = `
      #${CHAT_ID} { flex-grow: ${chat}; }
      #${COMBAT_ID} { flex-grow: ${combat}; }
    `
  }
}

function updateCombatTrackerStyle() {
  const enable = isChatOnCombatTrackerEnabled()
  if (enable && getActiveTab() === 'combat') {
    getChatElement().classList.add(ACTIVE_CLASS)
  } else if (getActiveTab() !== CHAT_ID) {
    getChatElement().classList.remove(ACTIVE_CLASS)
  }

  updateStyleElement()
}

Hooks.on('init', () => {
  createStyleElement()

  game.settings.register(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING, {
    name: 'Show chat on combat tracker tab',
    hint: 'Displays the chat log below the combat tracker',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: updateCombatTrackerStyle
  })

  game.settings.register(MODULE_NAME, COMBAT_TRACKER_TO_CHAT_RATIO_SETTING, {
    name: 'Combat Tracer to Chat ratio',
    hint: 'Changes the ratio by which the chat and the combat tracker are divided. Default: 1:1',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      '1:0': '1:0',
      '4:1': '4:1',
      '3:1': '3:1',
      '5:2': '5:2',
      '2:1': '2:1',
      '1:1': '1:1',
      '1:2': '1:2',
      '2:5': '2:5',
      '1:3': '1:3',
      '1:4': '1:4',
    },
    default: '1:1',
    onChange: updateCombatTrackerStyle
  })

  updateCombatTrackerStyle()
})

Hooks.on('ready', () => {
  const sidebar = ui.sidebar._tabs[0]
  const originalMethod = sidebar.activate
  sidebar.activate = function activateOverride(name, ...rest) {
    originalMethod.call(this, name, ...rest)
    updateCombatTrackerStyle()
  }
})
