import { View } from '@slack/web-api';
import {
    RequestType,
    SlackUser,
    Submission,
    ViewSubmission
} from './slack/api_interfaces';
import {
    normalisedTitleAndDesc,
    viewInputVal,
    viewSelectedVal,
    viewMultiSelectedVal,
    SlackCommand
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
    viewToSubmission: function(
        view: ViewSubmission['view'], request_type: RequestType
    ): Submission {
        const values = view.state.values;
        const submission: Submission = {};
        submission.title = viewInputVal('sl_title', values);
        submission.description = viewInputVal('ml_description', values);

        if (request_type === 'bug') {
            submission.currently = viewInputVal('sl_currently', values);
            submission.expected = viewInputVal('sl_expected', values);
        }

        if (request_type === 'data') {
            submission.reason = viewInputVal('ml_reason', values);
        }

        return submission;
    },
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
        const view_name = (feature.is_enabled('new_bug_fields') && key === 'bug')
            ? 'bug-new'
            : key;

        return views.support.syft[view_name];
    },
    viewToSubmission: function(
        view: ViewSubmission['view'], request_type: RequestType
    ): Submission {
        const values = view.state.values;
        const submission: Submission = {};
        submission.title = viewInputVal('sl_title', values);
        submission.description = viewInputVal('ml_description', values);

        if (request_type === 'bug') {
            submission.currently = viewInputVal('sl_currently', values);
            submission.expected = viewInputVal('sl_expected', values);

            if (feature.is_enabled('new_bug_fields')) {
                submission.component = viewMultiSelectedVal('ms_component', values);
                submission.version = viewInputVal('sl_version', values);
                submission.employer = viewInputVal('sl_employer', values);
                submission.worker = viewInputVal('sl_worker', values);
                submission.listing = viewInputVal('sl_listing', values);
                submission.shift = viewInputVal('sl_shift', values);
                submission.test_data = viewInputVal('sl_test_data', values);
                submission.region = viewSelectedVal('ss_region', values);
                submission.device = viewSelectedVal('ss_device', values);
            }
        }

        if (request_type === 'data') {
            submission.reason = viewInputVal('ml_reason', values);
        }

        return submission;
    },
    issueParams: function(
        submission: Submission,
        user: SlackUser,
        request_type: RequestType,
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
${submission.expected}`;

            if (feature.is_enabled('new_bug_fields')) {
                fields.description = `${fields.description}

Component/Platform: ${submission.component}

Region/Country: ${submission.region}

App version: ${submission.version}

Employer ID: ${submission.employer}

Worker ID: ${submission.worker}

Listing ID: ${submission.listing}

Shift ID: ${submission.shift}

Test data: ${submission.test_data}

Device: ${submission.device}`;
            }

            fields.description = `${fields.description}

Submitted by: ${user.name}`;

        } else {
            desc = `${desc}\n\nReason and urgency:\n${submission.reason}`;
            fields.issuetype.name = 'Data Request';
            fields.description = `${desc}\n\nSubmitted by: ${user.name}`;
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
            const newBugFields = feature.is_enabled('new_bug_fields')
                ? `*Component/Platform*: ${submission.component}\n\n` +
                `*Region/Country*: ${submission.region}\n\n` +
                `*App version*: ${submission.version}\n\n` +
                `*Employer ID*: ${submission.employer}\n\n` +
                `*Worker ID*: ${submission.worker}\n\n` +
                `*Listing ID*: ${submission.listing}\n\n` +
                `*Shift ID*: ${submission.shift}\n\n` +
                `*Test data*: ${submission.test_data}\n\n` +
                `*Device*: ${submission.device}\n\n`
                : '';

            return `<@${user.id}> has submitted a bug report:\n\n` +
                `*${submission.title}*\n\n` +
                `*Steps to Reproduce*\n\n${submission.description}\n\n` +
                `*Currently*\n\n${submission.currently}\n\n` +
                `*Expected*\n\n${submission.expected}\n\n` +
                newBugFields;
        } else {
            return `<@${user.id}> has submitted a data request:\n\n` +
                `*${submission.title}*\n\n${submission.description}\n` +
                `Reason and urgency:\n${submission.reason}`;
        }
    }
};

export default function supportConfig(key: string): Config {
    return configs[key];
}
