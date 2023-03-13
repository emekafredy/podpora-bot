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
const dataRequestTypeName = 'data';
const bugTypeName = 'bug';

configs.default = {
    commands: [
        {
            name: dataRequestTypeName,
            desc: 'Submit a request for data',
            example: '/support data'
        },
        {
            name: bugTypeName,
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

        if (request_type === bugTypeName) {
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
        if (request_type === bugTypeName) {
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
            name: dataRequestTypeName,
            desc: 'Submit a request for data',
            example: '/support data'
        },
        {
            name: bugTypeName,
            desc: 'Submit a bug report',
            example: '/support bug'
        }
    ],
    commandsHelpText: function(): string {
        return commandsHelpText(this.commands);
    },
    view: function(key: string): View {
        let template_name = key;
        if (feature.is_enabled('data_request_with_product_area_select_box')
            && key === dataRequestTypeName) {
            template_name = 'data_request_with_product_area';
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

        if (request_type === bugTypeName) {
            const platforms = (submission.platform as string[]);
            if (feature.is_enabled('bug_report_with_flex_domain_custom_field')) {
                // Setting customfield_10773 (Flex Domain)
                fields.customfield_10773 = { value: submission.product_area };
            }


            fields.components = platforms.map((platform) => ({ name: platform }));
            fields.issuetype.name = 'Bug';
            fields.description = `${desc}

Currently:
${submission.currently}

Expected:
${submission.expected}

Product Area: ${submission.product_area}
Urgent: ${submission.urgency}
Platform/Device: ${submission.platform}
Region/Country: ${submission.region}
App version: ${submission.version}
Employer ID: ${submission.employer}
Worker ID: ${submission.worker}
Listing ID: ${submission.listing}
Shift ID: ${submission.shift}
Test data: ${submission.test_data}

Submitted by: ${user.name}`;

        } else {
            let product_area_submission = '';
            if (feature.is_enabled('data_request_with_product_area_select_box')) {
                product_area_submission = `Product Area: ${submission.product_area}`;

                if (feature.is_enabled('data_request_with_flex_domain_custom_field')) {
                    // Setting customfield_10773 (Flex Domain)
                    fields.customfield_10773 = { value: submission.product_area };
                }
            }
            fields.issuetype.name = 'Data Request';
            fields.description = `${desc}

Reason:
${submission.reason}

${product_area_submission}
Urgency: ${submission.urgency}
Region/Country: ${submission.region}

Submitted by: ${user.name}`;
            fields.components = [{ name: 'Backend' }];
        }

        return result;
    },
    messageText(
        submission: Submission,
        user: SlackUser,
        request_type: RequestType
    ): string {
        if (request_type === bugTypeName) {
            return `<@${user.id}> has submitted a bug report:\n\n` +
                `*${submission.title}*\n\n` +
                `*Steps to Reproduce*:\n${submission.description}\n\n` +
                `*Currently*:\n${submission.currently}\n\n` +
                `*Expected*:\n${submission.expected}\n\n` +
                `*Product Area*:\n${submission.product_area}\n` +
                `*Urgent*: ${submission.urgency}\n` +
                `*Platform/Device*: ${submission.platform}\n` +
                `*Region/Country*: ${submission.region}\n` +
                `*App version*: ${submission.version}\n` +
                `*Employer ID*: ${submission.employer}\n` +
                `*Worker ID*: ${submission.worker}\n` +
                `*Listing ID*: ${submission.listing}\n` +
                `*Shift ID*: ${submission.shift}\n` +
                `*Test data*: ${submission.test_data}`;
        } else {
            let product_area_submission = '';
            if (feature.is_enabled('data_request_with_product_area_select_box')) {
                product_area_submission = `*Product Area*: ${submission.product_area}\n`;
            }
            return `<@${user.id}> has submitted a data request:\n\n` +
                `*${submission.title}*\n\n${submission.description}\n\n` +
                `*Reason*:\n${submission.reason}\n` +
                product_area_submission +
                `*Urgency*: ${submission.urgency}\n` +
                `*Region/Country*: ${submission.region}`;
        }
    }
};

export default function supportConfig(key: string): Config {
    return configs[key];
}
