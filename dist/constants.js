"use strict";

exports.__esModule = true;
exports.INITIALIZE_PLUGIN_LIFECYCLE_NAME_MAP = exports.MD5_CACHE_KEY = exports.LAST_COMPLETED_SOURCE_TIME = exports.CREATED_NODE_IDS = void 0;
const CREATED_NODE_IDS = `WPGQL-created-node-ids`;
exports.CREATED_NODE_IDS = CREATED_NODE_IDS;
const LAST_COMPLETED_SOURCE_TIME = `WPGQL-last-completed-source-time`;
exports.LAST_COMPLETED_SOURCE_TIME = LAST_COMPLETED_SOURCE_TIME;
const MD5_CACHE_KEY = `introspection-node-query-md5`;
exports.MD5_CACHE_KEY = MD5_CACHE_KEY;
const INITIALIZE_PLUGIN_LIFECYCLE_NAME_MAP = {
  unstable: `unstable_onPluginInit`,
  stable: `onPluginInit`
};
exports.INITIALIZE_PLUGIN_LIFECYCLE_NAME_MAP = INITIALIZE_PLUGIN_LIFECYCLE_NAME_MAP;
//# sourceMappingURL=constants.js.map