"use strict";

var _runSteps = require("./utils/run-steps");

var steps = _interopRequireWildcard(require("./steps"));

var _constants = require("./constants");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

let coreSupportsOnPluginInit;

try {
  const {
    isGatsbyNodeLifecycleSupported
  } = require(`gatsby-plugin-utils`);

  if (isGatsbyNodeLifecycleSupported(`onPluginInit`)) {
    coreSupportsOnPluginInit = `stable`;
  } else if (isGatsbyNodeLifecycleSupported(`unstable_onPluginInit`)) {
    coreSupportsOnPluginInit = `unstable`;
  }
} catch (e) {
  console.error(`Could not check if Gatsby supports onPluginInit lifecycle`);
}

const initializePluginLifeCycleName = _constants.INITIALIZE_PLUGIN_LIFECYCLE_NAME_MAP[coreSupportsOnPluginInit] || `onPreInit`;
module.exports = (0, _runSteps.runApisInSteps)({
  [initializePluginLifeCycleName]: [steps.setGatsbyApiToState, steps.setErrorMap, steps.tempPreventMultipleInstances],
  pluginOptionsSchema: steps.pluginOptionsSchema,
  createSchemaCustomization: [steps.setGatsbyApiToState, steps.ensurePluginRequirementsAreMet, steps.ingestRemoteSchema, steps.createSchemaCustomization],
  sourceNodes: [steps.setGatsbyApiToState, steps.persistPreviouslyCachedImages, steps.sourceNodes, steps.setImageNodeIdCache],
  onPreExtractQueries: [steps.onPreExtractQueriesInvokeLeftoverPreviewCallbacks],
  onPostBuild: [steps.setImageNodeIdCache, steps.logPostBuildWarnings],
  onCreatePage: [steps.onCreatepageSavePreviewNodeIdToPageDependency, steps.onCreatePageRespondToPreviewStatusQuery],
  onCreateDevServer: [steps.setImageNodeIdCache, steps.logPostBuildWarnings, steps.startPollingForContentUpdates]
});
//# sourceMappingURL=gatsby-node.js.map