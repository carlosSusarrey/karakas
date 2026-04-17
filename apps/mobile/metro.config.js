const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo (for @karakas/shared)
config.watchFolders = [monorepoRoot];

// Resolve packages: mobile's node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Prevent duplicate React — force mobile's copies
config.resolver.extraNodeModules = new Proxy(
  {
    react: path.resolve(projectRoot, "node_modules/react"),
    "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  },
  {
    get: (target, name) =>
      name in target
        ? target[name]
        : path.join(projectRoot, "node_modules", String(name)),
  }
);

module.exports = config;
