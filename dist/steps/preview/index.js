"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.sourcePreviews = exports.sourcePreview = exports.inPreviewMode = void 0;

var _getGatsbyApi = require("./../../utils/get-gatsby-api");

var _path = _interopRequireDefault(require("path"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _chalk = _interopRequireDefault(require("chalk"));

var _url = _interopRequireDefault(require("url"));

var _pQueue = _interopRequireDefault(require("p-queue"));

var _dumper = require("dumper.js");

var _fetchNodesPaginated = require("../source-nodes/fetch-nodes/fetch-nodes-paginated");

var _fetchGraphql = _interopRequireDefault(require("../../utils/fetch-graphql"));

var _store = _interopRequireDefault(require("../../store"));

var _update = require("../source-nodes/update-nodes/wp-actions/update");

var _formatLogMessage = require("../../utils/format-log-message");

var _fetchNodeUpdates = require("../source-nodes/update-nodes/fetch-node-updates");

const inDevelopPreview = process.env.NODE_ENV === `development` && !!process.env.ENABLE_GATSBY_REFRESH_ENDPOINT;
const inPreviewRunner = process.env.RUNNER_TYPE === `PREVIEW` || process.env.RUNNER_TYPE === `INCREMENTAL_PREVIEWS` || !!process.env.IS_GATSBY_PREVIEW; // this is a function simply because many places in the code expect it to be.
// it used to call store.getState() and check for some state to determine preview mode

const inPreviewMode = () => inDevelopPreview || inPreviewRunner;

exports.inPreviewMode = inPreviewMode;
let previewQueue;

const getPreviewQueue = () => {
  if (!previewQueue) {
    const {
      previewRequestConcurrency
    } = _store.default.getState().gatsbyApi.pluginOptions.schema;

    previewQueue = new _pQueue.default({
      concurrency: previewRequestConcurrency,
      carryoverConcurrencyCount: true
    });
  }

  return previewQueue;
}; // This checks wether or not we're already currently processing a preview
// for the passed preview id.


const previewForIdIsAlreadyBeingProcessed = id => {
  if (!id) {
    return false;
  }

  const existingCallbacks = _store.default.getState().previewStore.nodePageCreatedCallbacks;

  const alreadyProcessingThisPreview = !!(existingCallbacks !== null && existingCallbacks !== void 0 && existingCallbacks[id]);
  return alreadyProcessingThisPreview;
};
/**
 * For previews of draft posts, gatsby develop will throw a bunch of 404 errors
 * while WPGatsby is trying to read page-data.json
 * So we can write a dummy page-data.json if one doesn't exist.
 * that way there will be no 404's and Gatsby will overwrite our dummy file when it
 * needs to.
 */


const writeDummyPageDataJsonIfNeeded = async ({
  previewData,
  pageNode
}) => {
  if (!previewData.isDraft) {
    return;
  }

  const pageDataDirectory = _path.default.join(process.cwd(), `public/page-data`, pageNode.path);

  await _fsExtra.default.ensureDir(pageDataDirectory);

  const pageDataPath = _path.default.join(pageDataDirectory, `page-data.json`);

  const pageDataExists = await _fsExtra.default.pathExists(pageDataPath);

  if (!pageDataExists) {
    await _fsExtra.default.writeJSON(pageDataPath, {
      isDraft: previewData.isDraft
    });
  }
};

const createPreviewStatusCallback = ({
  previewData,
  reporter
}) => async ({
  passedNode,
  pageNode,
  context,
  status,
  graphqlEndpoint,
  error
}) => {
  var _data$wpGatsbyRemoteP;

  if (status === `PREVIEW_SUCCESS`) {
    // we might need to write a dummy page-data.json so that
    // Gatsby doesn't throw 404 errors when WPGatsby tries to read this file
    // that maybe doesn't exist yet
    await writeDummyPageDataJsonIfNeeded({
      previewData,
      pageNode
    });
  }

  const statusContext = error !== null && error !== void 0 && error.message ? `${context}\n\n${error.message}` : context;
  const {
    data
  } = await (0, _fetchGraphql.default)({
    url: graphqlEndpoint,
    query:
    /* GraphQL */
    `
      mutation MUTATE_PREVIEW_NODE($input: WpGatsbyRemotePreviewStatusInput!) {
        wpGatsbyRemotePreviewStatus(input: $input) {
          success
        }
      }
    `,
    variables: {
      input: {
        clientMutationId: `sendPreviewStatus`,
        modified: passedNode === null || passedNode === void 0 ? void 0 : passedNode.modified,
        pagePath: pageNode === null || pageNode === void 0 ? void 0 : pageNode.path,
        parentDatabaseId: previewData.parentDatabaseId || previewData.previewDatabaseId,
        // if the parentDatabaseId is 0 we want to use the previewDatabaseId
        status,
        statusContext
      }
    },
    errorContext: `Error occurred while mutating WordPress Preview node meta.`,
    forceReportCriticalErrors: true,
    headers: {
      WPGatsbyPreview: previewData.token,
      WPGatsbyPreviewUser: previewData.userDatabaseId
    }
  });

  if (data !== null && data !== void 0 && (_data$wpGatsbyRemoteP = data.wpGatsbyRemotePreviewStatus) !== null && _data$wpGatsbyRemoteP !== void 0 && _data$wpGatsbyRemoteP.success) {
    reporter.log((0, _formatLogMessage.formatLogMessage)(`Successfully sent Preview status back to WordPress post ${previewData.id} during ${context}`));
  } else {
    reporter.log((0, _formatLogMessage.formatLogMessage)(`failed to mutate WordPress post ${previewData.id} during Preview ${context}.\nCheck your WP server logs for more information.`));
  }
};
/**
 * This is called and passed the result from the ActionMonitor.previewData object along with a JWT token
 * It sources a single preview and creates the callback that's invoked to send preview status back to WPGatsby.
 * When the preview status is sent back to Gatsby, the preview action that this
 * logic is processing is deleted in the WP instance. That's why we call
 * previewForIdIsAlreadyBeingProcessed to see if another preview webhook
 * already started processing for this action
 */


const sourcePreview = async ({
  previewData,
  reporter
}, {
  url
}) => {
  if (previewForIdIsAlreadyBeingProcessed(previewData === null || previewData === void 0 ? void 0 : previewData.id)) {
    return;
  }

  const requiredProperties = [`previewDatabaseId`, `id`, `token`, `remoteUrl`, `parentDatabaseId`, `modified`, `userDatabaseId`];
  const missingProperties = requiredProperties.filter(property => !(property in previewData));

  if (!previewData || missingProperties.length) {
    reporter.warn((0, _formatLogMessage.formatLogMessage)(`sourcePreview was called but the required previewData properties weren't provided.`));
    reporter.info((0, _formatLogMessage.formatLogMessage)(`Missing properties: \n${JSON.stringify(missingProperties, null, 2)}`));
    reporter.log((0, _formatLogMessage.formatLogMessage)(`previewData: \n${JSON.stringify(previewData, null, 2)}`));
    return;
  }

  await (0, _fetchNodeUpdates.touchValidNodes)();

  const {
    hostname: settingsHostname
  } = _url.default.parse(url);

  const {
    hostname: remoteHostname
  } = _url.default.parse(previewData.remoteUrl);

  const sendPreviewStatus = createPreviewStatusCallback({
    previewData,
    reporter
  });

  if (settingsHostname !== remoteHostname) {
    await sendPreviewStatus({
      status: `RECEIVED_PREVIEW_DATA_FROM_WRONG_URL`,
      context: `check that the preview data came from the right URL.`,
      passedNode: {
        modified: previewData.modified,
        databaseId: previewData.parentDatabaseId
      },
      graphqlEndpoint: previewData.remoteUrl
    });
    reporter.warn((0, _formatLogMessage.formatLogMessage)(`Received preview data from a different remote URL than the one specified in plugin options. \n\n ${_chalk.default.bold(`Remote URL:`)} ${previewData.remoteUrl}\n ${_chalk.default.bold(`Plugin options URL:`)} ${url}`));
    return;
  } // this callback will be invoked when the page is created/updated for this node
  // then it'll send a mutation to WPGraphQL so that WP knows the preview is ready


  _store.default.dispatch.previewStore.subscribeToPagesCreatedFromNodeById({
    nodeId: previewData.id,
    modified: previewData.modified,
    sendPreviewStatus
  });

  await (0, _update.fetchAndCreateSingleNode)({
    actionType: `PREVIEW`,
    ...previewData,
    previewParentId: previewData.parentDatabaseId,
    isPreview: true
  });
};
/**
 * This is called when the /__refresh endpoint is posted to from WP previews.
 * It should only ever run in Preview mode, which is process.env.ENABLE_GATSBY_REFRESH_ENDPOINT = true
 * It first sources all pending preview actions, then calls sourcePreview() for each of them.
 */


exports.sourcePreview = sourcePreview;

const sourcePreviews = async (helpers, pluginOptions) => {
  const {
    webhookBody,
    reporter
  } = helpers;
  const {
    debug: {
      preview: inPreviewDebugModeOption
    }
  } = (0, _getGatsbyApi.getPluginOptions)();
  const inPreviewDebugMode = inPreviewDebugModeOption || process.env.WP_GATSBY_PREVIEW_DEBUG;

  if (inPreviewDebugMode) {
    reporter.info(`Sourcing previews for the following webhook:`);
    (0, _dumper.dump)(webhookBody);
  }

  if (previewForIdIsAlreadyBeingProcessed(webhookBody === null || webhookBody === void 0 ? void 0 : webhookBody.id)) {
    if (inPreviewDebugMode) {
      reporter.info(`Preview for id ${webhookBody === null || webhookBody === void 0 ? void 0 : webhookBody.id} is already being sourced.`);
    }

    return;
  }

  const previewActions = await (0, _fetchNodesPaginated.paginatedWpNodeFetch)({
    contentTypePlural: `actionMonitorActions`,
    nodeTypeName: `ActionMonitor`,
    headers: {
      WPGatsbyPreview: webhookBody.token,
      WPGatsbyPreviewUser: webhookBody.userDatabaseId
    },
    helpers,
    query:
    /* GraphQL */
    `
      query PREVIEW_ACTIONS($after: String) {
        actionMonitorActions(
          where: {
            previewStream: true
            status: PRIVATE
            orderby: { field: MODIFIED, order: DESC }
            sinceTimestamp: ${// only source previews made in the last 10 minutes
    Date.now() - 1000 * 60 * 10}
          }
          first: 100
          after: $after
        ) {
          nodes {
            previewData {
              id
              isDraft
              modified
              parentDatabaseId
              previewDatabaseId
              remoteUrl
              singleName
              userDatabaseId
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `
  });

  if (!(previewActions !== null && previewActions !== void 0 && previewActions.length)) {
    if (inPreviewDebugMode) {
      reporter.info(`Preview for id ${webhookBody === null || webhookBody === void 0 ? void 0 : webhookBody.id} returned no action monitor actions.`);
    }

    return;
  }

  if (inPreviewDebugMode) {
    reporter.info(`Preview for id ${webhookBody === null || webhookBody === void 0 ? void 0 : webhookBody.id} returned the following actions:`);
    (0, _dumper.dump)(previewActions);
  }

  const queue = getPreviewQueue();

  for (const {
    previewData
  } of previewActions) {
    queue.add(() => sourcePreview({
      previewData: { ...previewData,
        token: webhookBody.token
      },
      reporter
    }, pluginOptions));
  }

  await Promise.all([queue.onEmpty(), queue.onIdle()]);
};

exports.sourcePreviews = sourcePreviews;
//# sourceMappingURL=index.js.map