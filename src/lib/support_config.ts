import fs from 'fs';
import path from 'path';
import { View } from '@slack/web-api';
import {
    SlackUser,
    Submission,
    ViewSubmission
} from './slack/api_interfaces';
import {
    CreateIssue
} from './jira/api_interfaces';
import {
    normalisedTitleAndDesc,
    viewInputVal,
    SlackCommand
} from './slack_jira_helpers';
import feature from '../util/feature';

interface Views {
    [index: string]: View
}

interface SupportConfig {
    commands: Array<SlackCommand>,
    commandsHelpText: () => string,
    view: (key: string) => View,
    viewToSubmission: (
        view: ViewSubmission['view'],
        request_type: string
    ) => Submission,
    issueParams: (
        submission: Submission,
        user: SlackUser,
        request_type: string
    ) => CreateIssue,
    messageText: (
        submission: Submission,
        user: SlackUser,
        request_type: string
    ) => string
}

const viewsDirectoryPath = path.join(__dirname, '..', 'views', 'support', 'default');
const views: Views = {};
fs.readdirSync(viewsDirectoryPath).reduce((acc, name: string) => {
    const fpath = path.join(viewsDirectoryPath, name);
    acc[path.parse(fpath).name] = JSON.parse(
        fs.readFileSync(fpath).toString()
    );
    return acc;
}, views);

function commandsHelpText(commands: Array<SlackCommand>): string {
    return '👋 Need help with support bot?\n\n' + commands.map(
        (cmd) => {
            return `> ${cmd.desc}:\n>\`${cmd.example}\``;
        }).join('\n\n');
}

function viewToSubmission(
    view: ViewSubmission['view'],
    request_type: string
): Submission {
    const values = view.state.values;
    const submission: Submission = {};
    submission.title = viewInputVal('sl_title', values) as string;
    submission.description = viewInputVal('ml_description', values) as string;

    if (request_type === 'bug') {
        submission.currently = viewInputVal('sl_currently', values);
        submission.expected = viewInputVal('sl_expected', values);
    }

    if (request_type === 'data') {
        submission.reason = viewInputVal('ml_reason', values) as string;
    }

    return submission;
}

const configs: { [index: string]: SupportConfig } = {};

configs.default = {
    commands: [
        {
            name: 'data',
            desc: 'Submit a request for data',
            example: '/support data'
        },
        {
            name: 'bug',
            desc: 'Submit a bug report',
            example: '/support bug'
        }
    ],
    commandsHelpText: function(): string {
        return commandsHelpText(this.commands);
    },
    view: function(key: string): View {
        return views[key];
    },
    viewToSubmission: viewToSubmission,
    issueParams: function(
        submission: Submission,
        user: SlackUser,
        request_type: string,
    ): CreateIssue {
        const board = 'SUP';
        const title_and_desc = normalisedTitleAndDesc(submission);
        const title = title_and_desc.title;
        let desc = title_and_desc.desc;
        let issue_type: string;

        if (request_type === 'bug') {
            issue_type = 'Bug';
            desc = `${desc}

Currently:
${submission.currently}

Expected:
${submission.expected}`;

        } else {
            issue_type = 'Task';
        }

        desc = `${desc}

Submitted by: ${user.name}`;

        return {
            fields: {
                project: { key: board },
                summary: title,
                issuetype: { name: issue_type },
                description: desc,
                labels: ['support']
            }
        };
    },
    messageText(
        submission: Submission,
        user: SlackUser,
        request_type: string
    ): string {
        if (request_type === 'bug') {
            return `<@${user.id}> has submitted a bug report:\n\n` +
                `*${submission.title}*\n\n` +
                `*Steps to Reproduce*\n\n${submission.description}\n\n` +
                `*Currently*\n\n${submission.currently}\n\n` +
                `*Expected*\n\n${submission.expected}`;
        } else {
            return `<@${user.id}> has submitted a data request:\n\n` +
                `*${submission.title}*\n\n${submission.description}\n` +
                `Reason and urgency:\n${submission.reason}`;
        }
    }
};


configs.syft = {
    commands: [
        {
            name: 'data',
            desc: 'Submit a request for data',
            example: '/support data'
        },
        {
            name: 'bug',
            desc: 'Submit a bug report',
            example: '/support bug'
        }
    ],
    commandsHelpText: function(): string {
        return commandsHelpText(this.commands);
    },
    view: function(key: string): View {
        return configs.default.view(key);
    },
    viewToSubmission: viewToSubmission,
    issueParams: function(
        submission: Submission,
        user: SlackUser,
        request_type: string,
    ): CreateIssue {
        const title_and_desc = normalisedTitleAndDesc(submission);
        const title = title_and_desc.title;
        const board = 'SUP';
        let desc = title_and_desc.desc;
        const fields: CreateIssue['fields'] = {
            project: { key: board },
            summary: title,
            issuetype: { name: '' },
            description: '',
            labels: ['support']
        };
        const result: CreateIssue = { fields: fields };

        if (request_type === 'bug') {
            fields.issuetype.name = 'Bug';
            fields.description = `${desc}

Currently:
${submission.currently}

Expected:
${submission.expected}

Submitted by: ${user.name}`;

        } else {
            desc = `${desc}\n\nReason and urgency:\n${submission.reason}`;
            fields.project.key = 'INTOPS';
            fields.issuetype.name = 'Data Request';
            fields.description = `${desc}\n\nSubmitted by: ${user.name}`;
            fields.components = [{ name: 'Back-end' }];

            if (feature.is_enabled('data_request_transition')) {
                result.transition = {
                    'id': '131',
                    'looped': true
                };
            }
        }

        return result;
    },
    messageText(
        submission: Submission,
        user: SlackUser,
        request_type: string
    ): string {
        return configs.default.messageText(submission, user, request_type);
    }
};

export default function supportConfig(key: string): SupportConfig {
    return configs[key];
}
