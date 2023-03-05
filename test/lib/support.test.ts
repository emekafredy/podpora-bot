import nock from 'nock';
import { Logger } from 'winston';
import { fixture } from '../helpers';
import logger from '../../src/util/logger';
import { store } from '../../src/util/secrets';
import {
    SlackMessage,
    Slack
} from '../../src/lib/slack';
import {
    Jira
} from '../../src/lib/jira';

import { support } from '../../src/lib/support';
import {
    ChannelThreadFileShareEvent,
} from '../../src/lib/slack/api_interfaces';
// import feature from '../../src/util/feature';

const logErrorSpy = jest.spyOn(logger, 'error').mockReturnValue({} as Logger);

afterEach(() => {
    jest.clearAllMocks();
});

const slack_options = store.slackOptions('T0001');
const slack = new Slack(slack_options);
const postMsgResponse = fixture('slack/chat.postMessage.response');
const slack_message = postMsgResponse as SlackMessage;

describe('#postIssueUrlOnThread(url, )', () => {
    const url = 'https://example.atlassian.net/issue/10008';
    it('returns a Promise that resolves to SupportRequest', (done) => {
        expect.assertions(1);
        nock('https://slack.com')
            .post('/api/chat.postMessage')
            .reply(200, { ok: true });

        support.postIssueUrlOnThread(slack, url, slack_message)
            .then((res) => {
                expect(res.ok).toEqual(true);
                done();
            });
    });

    describe('failure', () => {
        it('it log the failure and returns error response', (done) => {
            expect.assertions(3);
            nock('https://slack.com')
                .post('/api/chat.postMessage')
                .reply(200, { ok: false });

            support.postIssueUrlOnThread(slack, url, slack_message)
                .catch((error) => {
                    expect(error.message).toContain('postIssueUrlOnThread');
                    expect(logErrorSpy).toHaveBeenCalled();
                    const logger_call = logErrorSpy.mock.calls[0].toString();
                    expect(logger_call).toEqual(
                        expect.stringContaining('postIssueUrlOnThread')
                    );
                    done();
                });
        });
    });
});

describe('#showForm()', () => {
    describe('when something goes wrong (api call)', () => {
        // when trying set reply http status anything else than 200 ;/
        // "[WARN]  web-api:WebClient:0 http request failed Nock: No match for request {
        it('logs the error', (done) => {
            expect.assertions(2);
            nock('https://slack.com')
                .post('/api/views.open')
                .reply(200, { ok: false });

            support.showForm(slack, 'bug', 'abc')
                .catch(() => {
                    expect(logErrorSpy).toHaveBeenCalled();
                    const logger_call = logErrorSpy.mock.calls[0].toString();

                    expect(logger_call).toEqual(
                        expect.stringContaining('showForm')
                    );
                    done();
                });
        });
    });

    describe('fields', () => {
        it('sends modal form with title and description fields', () => {
            let api_call_body = '';

            expect.assertions(2);
            nock('https://slack.com')
                .post('/api/views.open', body => {
                    api_call_body = JSON.stringify(body);
                    return body;
                })
                .reply(200, { ok: true });

            return support.showForm(slack, 'bug', 'abc')
                .then(() => {
                    expect(api_call_body).toContain('sl_title');
                    expect(api_call_body).toContain('ml_description');
                });
        });
    });
});

describe('#addFileToJiraIssue(slack, jira, event)', () => {
    const event = fixture('slack/events.message_with_file').event as ChannelThreadFileShareEvent;
    const jira = new Jira(store.jiraOptions('T0001'));
    const storeGetSpy = jest.spyOn(store, 'get');

    describe('when fetching user name fail', () => {
        it('add message as comment to Jira Issue with user id', (done) => {
            expect.assertions(1);
            const issue_key = 'foo-issue-key';
            const checkJiraComment = (body: string): void => {
                expect(body).toContain('UHAV00MD0');

                done();
            };

            nock('https://example.com')
                .post(`/rest/api/2/issue/${issue_key}/comment`, (body) => {
                    checkJiraComment(JSON.stringify(body));
                    return body;
                }).reply(200);

            nock('https://slack.com')
                .post('/api/users.info')
                .reply(200, { ok: false, error: 'something wrong' });

            storeGetSpy.mockImplementationOnce(() => {
                return Promise.resolve(issue_key);
            });
            support.addFileToJiraIssue(slack, jira, event);
        });
    });

    describe('when issue key not found db', () => {
        it('logs the error', (done) => {
            expect.assertions(2);

            storeGetSpy.mockImplementationOnce(() => {
                return Promise.resolve(null);
            });

            logErrorSpy.mockImplementationOnce((msg) => {
                expect(msg).toContain('addFileToJiraIssue');
                expect(msg.toString()).toContain('Issue key not found');
                done();
                return {} as Logger;
            });

            support.addFileToJiraIssue(slack, jira, event);
        });
    });

    describe('when file(s) are not accessible directly', () => {
        const event = fixture(
            'slack/events.message_with_file_in_connected_channel'
        ).event as ChannelThreadFileShareEvent;
        const file_info = fixture('slack/files.info');
        const user_info = fixture('slack/users.info.response');

        it('retrieves the file using Slack API', (done) => {
            expect.assertions(2);
            const issue_key = 'foo-issue-key';
            const checkJiraComment = (body: string): void => {
                expect(body).toContain('Egon Spengler'); // from user_info
                expect(body).toContain('tedair.gif'); // from file_info

                done();
            };

            nock('https://example.com')
                .post(`/rest/api/2/issue/${issue_key}/comment`, (body) => {
                    checkJiraComment(JSON.stringify(body));
                    return body;
                }).reply(200);

            nock('https://slack.com')
                .post('/api/users.info')
                .reply(200, user_info);

            nock('https://slack.com')
                .post('/api/files.info')
                .reply(200, file_info);

            storeGetSpy.mockImplementationOnce(() => {
                return Promise.resolve(issue_key);
            });
            support.addFileToJiraIssue(slack, jira, event);
        });
    });
});
