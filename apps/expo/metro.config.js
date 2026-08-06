// Metro config for the monorepo: the app's dependencies (including
// @diet/domain) are hoisted to the repo root node_modules, and the shared
// package ships TypeScript sources directly. Watch the whole workspace and
// resolve node_modules from both the app and the repo root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
