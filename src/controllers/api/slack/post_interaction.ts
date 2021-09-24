'use strict';

import { Response, Request } from 'express';
import logger, { sanitise_for_log } from '../../../util/logger';
import { store } from '../../../util/secrets';
import { Slack } from '../../../lib/slack';
import { Jira } from '../../../lib/jira';
import { support } from '../../../lib/support';
import { product } from '../../../lib/product';
import {
    ViewSubmission,
    InteractionTypes,
    PostInteractionPayload,
    Shortcut,
    BlockActions,
    RequestType
} from '../../../lib/slack/api_interfaces';

function handleViewSubmission(params: ViewSubmission, res: Response): Response {
    const { team, view } = params;
    const private_metadata = view.private_metadata;
    const [type, subtype] = view.private_metadata.split('_');
    const slack_options = store.slackOptions(team.id);
    const slack = new Slack(slack_options);
    const jira_options = store.jiraOptions(team.id);
    const jira = new Jira(jira_options);

    if (type === 'support') {
        return support.handleViewSubmission(
            slack, jira, params, (subtype as RequestType), res
        );
    }

    if (type === 'product') {
        return product.handleViewSubmission(
            slack, jira, params, (subtype as RequestType), res
        );
    }

    throw new Error('Unexpected state param: ' + private_metadata);
}

function handleShortcut(params: Shortcut, res: Response): Response {
    const { team, callback_id } = params;
    const [type] = callback_id.split('_');
    const slack_options = store.slackOptions(team.id);
    const slack = new Slack(slack_options);

    if (type === 'support') {
        support.handleShortcut(slack, params, res);
    } else {
        logger.debug(
            'shortcut: ' +
            JSON.stringify(params)
        );
    }

    return res;
}

function handleBlockActions(params: BlockActions, res: Response): Response {
    logger.debug(
        'block_actions: ' + JSON.stringify(params)
    );

    return res;
}

function interactionHandler(params: PostInteractionPayload, res: Response): Response {
    if (params.type == InteractionTypes.view_submission) {
        return handleViewSubmission(params as ViewSubmission, res);
    }

    if (params.type == InteractionTypes.shortcut) {
        return handleShortcut(params as Shortcut, res);
    }

    if (params.type == InteractionTypes.block_actions) {
        return handleBlockActions(params as BlockActions, res);
    }

    throw new Error('Unexpected interaction: ' + params.type);
}

/**
 * POST /api/slack/interaction
 *
 */
export const postInteraction = (req: Request, res: Response): void => {
    try {
        interactionHandler(
            JSON.parse(req.body.payload),
            res
        );
    } catch (error) {
        logger.error('postInteraction', error, sanitise_for_log(req.body));
    }

    res.status(200).send();
};
