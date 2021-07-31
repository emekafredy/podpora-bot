'use strict';

// import feature from '../../util/feature';
import { Response, Request } from 'express';
import logger from '../../util/logger';
import { store } from '../../util/secrets';
import { Slack } from '../../lib/slack';
import { Jira } from '../../lib/jira';
import {
    IssueChangelog,
    Issue,
    IssueLink,
    DetailIssueLinks,
    isOutwardIssueDetailLink,
    DetailInwardIssueLink,
    DetailOutwardIssueLink
} from '../../lib/jira/api_interfaces';
import {
    statusChangeMessage
} from '../../lib/slack_jira_helpers';

interface SlackThread {
    team: string
    channel: string
    ts: string
}

function handleStatusChange(
    issue: Issue,
    changelog: IssueChangelog,
    slack_thread: SlackThread
): void {
    const slack_options = store.slackOptions(slack_thread.team);
    const slack = new Slack(slack_options);
    const message = statusChangeMessage(changelog);

    if (message === null) {
        return;
    }

    slack.postOnThread(
        message,
        slack_thread.channel,
        slack_thread.ts
    );
}

function handleAttachmentChange(
    issue: Issue,
    changelog: IssueChangelog,
    slack_thread: SlackThread
): void {
    const slack_options = store.slackOptions(slack_thread.team);
    const slack = new Slack(slack_options);
    const attachment_change = changelog.items.find((el) => el.field === 'Attachment');
    if (!attachment_change) {
        return;
    }

    const filename = attachment_change.toString;
    const attachment = issue.fields.attachment.find((el) => {
        return el.filename == filename;
    });

    if (!attachment) {
        return;
    }

    const message = `File [${filename}] has been attached. \n` +
        `Download: ${attachment.content}`;

    slack.postOnThread(
        message,
        slack_thread.channel,
        slack_thread.ts
    );
}

function issueLinkToMessage(jira: Jira, link: DetailIssueLinks): string {
    let issue;
    let what;
    let lnk;
    if (isOutwardIssueDetailLink(link)) {
        lnk = link as DetailOutwardIssueLink;
        what = lnk.type.outward;
        issue = lnk.outwardIssue;
    } else {
        lnk = link as DetailInwardIssueLink;
        what = lnk.type.inward;
        issue = lnk.inwardIssue;
    }

    const url = jira.issueUrl(issue);
    const summary = issue.fields.summary;
    const status = issue.fields.status.name;

    return `${what} ${url} \n${summary} \nStatus: ${status}`;
}

function handleIssueLinkCreated(jira: Jira, issueLink: IssueLink): void {
    function updateIssueSlackThread(issue: Issue): void {
        const issue_key = jira.toKey(issue);

        store.get(issue_key)
            .then((res) => {
                if (res === null) {
                    return;
                }

                const link = issue.fields.issuelinks
                    .find((el) => {
                        return parseInt(el.id) === issueLink.id;
                    });

                if (link === undefined) {
                    return;
                }

                const message = issueLinkToMessage(jira, link);

                const [team, channel, ts] = res.split(',');
                const slack_thread = { team, channel, ts };
                const slack_options = store.slackOptions(slack_thread.team);
                const slack = new Slack(slack_options);

                slack.postOnThread(
                    message,
                    slack_thread.channel,
                    slack_thread.ts
                );
            }).catch((error) => {
                logger.error(error.message);
            });
    }

    const source_issue_promise = jira.find(issueLink.sourceIssueId);

    source_issue_promise
        .then(updateIssueSlackThread);

    const dest_issue_promise = jira.find(issueLink.destinationIssueId);

    dest_issue_promise
        .then(updateIssueSlackThread);
}

function handleIssueUpdate(jira: Jira, issue: Issue, changelog: IssueChangelog): void {
    const issue_key = jira.toKey(issue);

    store.get(issue_key)
        .then((res) => {
            if (res === null) {
                return;
            }

            const [team, channel, ts] = res.split(',');
            const slack_thread = { team, channel, ts };
            handleStatusChange(issue, changelog, slack_thread);
            handleAttachmentChange(issue, changelog, slack_thread);
        }).catch((error) => {
            logger.error(error.message);
        });
}

/**
 * POST /api/jira/:team_id
 *
 */
export const postEvent = (req: Request, res: Response): void => {
    const body = req.body;
    const team_id = req.params.team_id;
    const jira_options = store.jiraOptions(team_id);

    if (jira_options) {
        const jira = new Jira(jira_options);

        if (body.webhookEvent === 'jira:issue_updated') {
            handleIssueUpdate(jira, body.issue, body.changelog);
        } else if (body.webhookEvent === 'issuelink_created') {
            handleIssueLinkCreated(jira, body.issueLink);
        }

        res.status(200).send();
    } else {
        res.status(404).send({ error: 'Team not found' });
    }
};
