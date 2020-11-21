const MODULE_NAME = 'foundry-combat-focus'
const CHAT_ON_COMBAT_TRACKER_SETTING = 'showChatOnCombatTrackerTab'
const CHAT_ID = 'chat'
const ACTIVE_CLASS = 'active'

function isChatOnCombatTrackerEnabled() {
  return game.settings.get(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING)
}

function getActiveTab() {
  return ui.sidebar.activeTab
}

function getChatElement() {
  return document.getElementById(CHAT_ID)
}

function updateCombatTrackerStyle() {
  const enable = isChatOnCombatTrackerEnabled()
  if (enable && getActiveTab() === 'combat') {
    getChatElement().classList.add(ACTIVE_CLASS)
  } else if (getActiveTab() !== CHAT_ID) {
    getChatElement().classList.remove(ACTIVE_CLASS)
  }
}

Hooks.on('init', () => {
  game.settings.register(MODULE_NAME, CHAT_ON_COMBAT_TRACKER_SETTING, {
    name: 'Show chat on combat tracker tab',
    hint: 'Displays the chat log below the combat tracker',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
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
