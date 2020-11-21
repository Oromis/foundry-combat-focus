const MODULE_JSON_PATH = './module.json'

const fs = require('fs')
const packageJson = require('../package.json')

const moduleJson = JSON.parse(fs.readFileSync(MODULE_JSON_PATH, { encoding: 'utf-8' }))
moduleJson.version = packageJson.version
fs.writeFileSync(MODULE_JSON_PATH, JSON.stringify(moduleJson, null, 2), { encoding: 'utf-8' })
