import { View } from '@slack/web-api';
import {
    RequestType,
    SlackUser,
    Submission
} from './slack/api_interfaces';
import {
    normalisedTitleAndDesc,
    SlackCommand,
    viewToSubmission
} from './slack_jira_helpers';
import {
    CreateIssue
} from './jira/api_interfaces';
import Config from './config';
import views from './views';
import feature from '../util/feature';

function commandsHelpText(commands: Array<SlackCommand>): string {
    return '👋 Need help with support bot?\n\n' + commands.map(
        (cmd) => {
            return `> ${cmd.desc}:\n>\`${cmd.example}\``;
        }).join('\n\n');
}

const configs: { [index: string]: Config } = {};

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
        return views.support.default[key];
    },
    viewToSubmission: viewToSubmission,
    issueParams: function(
        submission: Submission,
        user: SlackUser,
        request_type: RequestType
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
        request_type: RequestType
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
        let template_name = key;
        if (feature.is_enabled('bug_report_with_product_area_select_box') && key === 'bug') {
            template_name = 'bug_report_with_product_area';
        }

        return views.support.syft[template_name];
    },
    viewToSubmission: viewToSubmission,
    issueParams: function(
        submission: Submission,
        user: SlackUser,
        request_type: RequestType,
    ): CreateIssue {
        const title_and_desc = normalisedTitleAndDesc(submission);
        const title = title_and_desc.title;
        const board = 'SUP';
        const desc = title_and_desc.desc;
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

Urgent: ${submission.urgency}
Component/Platform: ${submission.component}
Region/Country: ${submission.region}
App version: ${submission.version}
Employer ID: ${submission.employer}
Worker ID: ${submission.worker}
Listing ID: ${submission.listing}
Shift ID: ${submission.shift}
Test data: ${submission.test_data}
Device: ${submission.device}

Submitted by: ${user.name}`;

        } else {
            fields.issuetype.name = 'Data Request';
            fields.description = `${desc}

Reason:
${submission.reason}

Urgency: ${submission.urgency}
Region/Country: ${submission.region}

Submitted by: ${user.name}`;
            fields.components = [{ name: 'Back-end' }];
        }

        return result;
    },
    messageText(
        submission: Submission,
        user: SlackUser,
        request_type: RequestType
    ): string {
        if (request_type === 'bug') {
            let product_area_submission = '';
            if (feature.is_enabled('bug_report_with_product_area_select_box')) {
                product_area_submission = `*Domain*: ${submission.product_area}\n`;
            }

            return `<@${user.id}> has submitted a bug report:\n\n` +
                `*${submission.title}*\n\n` +
                `*Steps to Reproduce*:\n${submission.description}\n\n` +
                `*Currently*:\n${submission.currently}\n\n` +
                `*Expected*:\n${submission.expected}\n\n` +
                product_area_submission +
                `*Urgent*: ${submission.urgency}\n` +
                `*Component/Platform*: ${submission.component}\n` +
                `*Region/Country*: ${submission.region}\n` +
                `*App version*: ${submission.version}\n` +
                `*Employer ID*: ${submission.employer}\n` +
                `*Worker ID*: ${submission.worker}\n` +
                `*Listing ID*: ${submission.listing}\n` +
                `*Shift ID*: ${submission.shift}\n` +
                `*Test data*: ${submission.test_data}\n` +
                `*Device*: ${submission.device}`;
        } else {
            return `<@${user.id}> has submitted a data request:\n\n` +
                `*${submission.title}*\n\n${submission.description}\n\n` +
                `*Reason*:\n${submission.reason}\n` +
                `*Urgency*: ${submission.urgency}\n` +
                `*Region/Country*: ${submission.region}`;
        }
    }
};

export default function supportConfig(key: string): Config {
    return configs[key];
}
