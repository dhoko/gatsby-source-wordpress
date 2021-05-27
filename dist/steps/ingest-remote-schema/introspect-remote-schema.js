"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.introspectAndStoreRemoteSchema = void 0;

var _chalk = _interopRequireDefault(require("chalk"));

var diff = _interopRequireWildcard(require("diff"));

var _lodash = require("lodash");

var _store = _interopRequireDefault(require("../../store"));

var _cache = require("../../utils/cache");

var _fetchGraphql = _interopRequireDefault(require("../../utils/fetch-graphql"));

var _graphqlQueries = require("../../utils/graphql-queries");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const introspectAndStoreRemoteSchema = async () => {
  var _pluginOptions$debug, _pluginOptions$debug$, _pluginOptions$debug2;

  const state = _store.default.getState();

  const {
    pluginOptions
  } = state.gatsbyApi;
  const {
    schemaWasChanged
  } = state.remoteSchema;
  const INTROSPECTION_CACHE_KEY = `${pluginOptions.url}--introspection-data`;
  let introspectionData = await (0, _cache.getPersistentCache)({
    key: INTROSPECTION_CACHE_KEY
  });
  const printSchemaDiff = (pluginOptions === null || pluginOptions === void 0 ? void 0 : (_pluginOptions$debug = pluginOptions.debug) === null || _pluginOptions$debug === void 0 ? void 0 : (_pluginOptions$debug$ = _pluginOptions$debug.graphql) === null || _pluginOptions$debug$ === void 0 ? void 0 : _pluginOptions$debug$.printIntrospectionDiff) || (pluginOptions === null || pluginOptions === void 0 ? void 0 : (_pluginOptions$debug2 = pluginOptions.debug) === null || _pluginOptions$debug2 === void 0 ? void 0 : _pluginOptions$debug2.preview);
  let staleIntrospectionData;

  if (!introspectionData || schemaWasChanged) {
    const {
      data
    } = await (0, _fetchGraphql.default)({
      query: _graphqlQueries.introspectionQuery
    });

    if (introspectionData) {
      staleIntrospectionData = introspectionData;
    }

    introspectionData = data; // cache introspection response

    await (0, _cache.setPersistentCache)({
      key: INTROSPECTION_CACHE_KEY,
      value: introspectionData
    });
  }

  if (staleIntrospectionData && printSchemaDiff) {
    console.log(`\nData changed in WordPress schema:`);

    staleIntrospectionData.__schema.types.forEach(type => {
      const staleTypeJSON = JSON.stringify(type, null, 2);

      const newType = introspectionData.__schema.types.find(({
        name
      }) => name === type.name);

      const newTypeJSON = JSON.stringify(newType, null, 2);

      if (staleTypeJSON === newTypeJSON) {
        return;
      }

      const typeDiff = type && newType ? (0, _lodash.uniqBy)(diff.diffJson(type, newType), `value`) : null;

      if (typeDiff !== null && typeDiff !== void 0 && typeDiff.length) {
        console.log(`\nFound changes to the ${type.name} type\n`);
        typeDiff.forEach(part => {
          if (part.added || part.removed) {
            console.log(_chalk.default.green(_chalk.default.bold(`${part.added ? `Added` : `Removed`}:\n`) + part.value.trim().split(`\n`).map((line, index) => `${part.added ? `+` : `-`}${index === 0 ? `\t` : ` `}${line}`).join(`\n`)));
          }
        });
        console.log(`\n`);
      }
    });
  }

  const typeMap = new Map(introspectionData.__schema.types.map(type => [type.name, type]));

  _store.default.dispatch.remoteSchema.setState({
    introspectionData,
    typeMap
  });
};

exports.introspectAndStoreRemoteSchema = introspectAndStoreRemoteSchema;
//# sourceMappingURL=introspect-remote-schema.js.map