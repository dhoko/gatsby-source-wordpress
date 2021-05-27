"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.startPollingForContentUpdates = void 0;

var _formatLogMessage = require("../../../utils/format-log-message");

var _store = _interopRequireDefault(require("../../../store"));

var _getGatsbyApi = require("../../../utils/get-gatsby-api");

var _graphqlQueries = require("../../../utils/graphql-queries");

var _fetchGraphql = _interopRequireDefault(require("../../../utils/fetch-graphql"));

var _constants = require("../../../constants");

/**
 * This function checks wether there is atleast 1 WPGatsby action ready to be processed by Gatsby
 * If there is, it calls the refresh webhook so that schema customization and source nodes run again.
 */
const checkForNodeUpdates = async ({
  cache,
  emitter
}) => {
  // get the last sourced time
  const lastCompletedSourceTime = await cache.get(_constants.LAST_COMPLETED_SOURCE_TIME);
  const since = lastCompletedSourceTime - 500; // make a graphql request for any actions that have happened since

  const {
    data: {
      actionMonitorActions: {
        nodes: newActions
      }
    }
  } = await (0, _fetchGraphql.default)({
    query: _graphqlQueries.contentPollingQuery,
    variables: {
      since
    },
    // throw fetch errors and graphql errors so we can auto recover in refetcher()
    throwGqlErrors: true,
    throwFetchErrors: true
  });

  if (newActions.length) {
    // if there's atleast 1 new action, pause polling,
    // refresh Gatsby schema+nodes and continue on
    _store.default.dispatch.develop.pauseRefreshPolling();

    emitter.emit(`WEBHOOK_RECEIVED`, {
      webhookBody: {
        since,
        refreshing: true
      }
    });
  } else {
    // set new last completed source time and move on
    await cache.set(_constants.LAST_COMPLETED_SOURCE_TIME, Date.now());
  }
};

const refetcher = async (msRefetchInterval, helpers, {
  reconnectionActivity = null,
  retryCount = 1
} = {}) => {
  try {
    const {
      refreshPollingIsPaused
    } = _store.default.getState().develop;

    if (!refreshPollingIsPaused) {
      await checkForNodeUpdates(helpers);
    }

    if (reconnectionActivity) {
      reconnectionActivity.end();
      helpers.reporter.success((0, _formatLogMessage.formatLogMessage)(`Content updates re-connected after ${retryCount} ${retryCount === 1 ? `try` : `tries`}`));
      reconnectionActivity = null;
      retryCount = 1;
    }
  } catch (e) {
    var _pluginOptions$debug;

    const {
      pluginOptions
    } = (0, _getGatsbyApi.getGatsbyApi)();

    if (pluginOptions !== null && pluginOptions !== void 0 && (_pluginOptions$debug = pluginOptions.debug) !== null && _pluginOptions$debug !== void 0 && _pluginOptions$debug.throwRefetchErrors) {
      throw e;
    }

    if (!reconnectionActivity) {
      reconnectionActivity = helpers.reporter.activityTimer((0, _formatLogMessage.formatLogMessage)(`Content update error: "${e.message}"`));
      reconnectionActivity.start();
      reconnectionActivity.setStatus(`retrying...`);
    } else {
      retryCount++;
      reconnectionActivity.setStatus(`retried ${retryCount} times`);
    } // retry after retry count times 5 seconds


    const retryTime = retryCount * 5000; // if the retry time is greater than or equal to the max (60 seconds)
    // use the max, otherwise use the retry time

    const maxWait = 60000;
    const waitFor = retryTime >= maxWait ? maxWait : retryTime;
    await new Promise(resolve => setTimeout(resolve, waitFor));
  }

  setTimeout(() => refetcher(msRefetchInterval, helpers, {
    reconnectionActivity,
    retryCount
  }), msRefetchInterval);
};
/**
 * Starts constantly refetching the latest WordPress changes
 * so we can update Gatsby nodes when data changes
 */


const startPollingForContentUpdates = helpers => {
  if (process.env.WP_DISABLE_POLLING || process.env.ENABLE_GATSBY_REFRESH_ENDPOINT) {
    return;
  }

  const {
    verbose,
    develop
  } = _store.default.getState().gatsbyApi.pluginOptions;

  const msRefetchInterval = develop.nodeUpdateInterval;

  if (verbose) {
    helpers.reporter.log(``);
    helpers.reporter.info((0, _formatLogMessage.formatLogMessage)`Watching for WordPress changes`);
  }

  refetcher(msRefetchInterval, helpers);
};

exports.startPollingForContentUpdates = startPollingForContentUpdates;
//# sourceMappingURL=content-update-interval.js.map