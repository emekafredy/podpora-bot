import nock from 'nock';
import { Logger } from 'winston';
import { fixture } from '../helpers';
import logger from '../../src/util/logger';
import {
    SlackMessage,
    Slack
} from '../../src/lib/slack';
import supportConfig from '../../src/lib/support_config';

afterEach(() => {
    jest.clearAllMocks();
});

describe('Slack', () => {
    const config = {
        id: 'abc',
        api_token: 'dummy api token',
        domain: 'qwerty'
    };
    const slack = new Slack(config);
    const loggerSpy = jest.spyOn(logger, 'error').mockReturnValue({} as Logger);
    const postMsgResponse = fixture('slack/chat.postMessage.response');
    const slack_message = postMsgResponse as SlackMessage;
    const messageText = supportConfig('default').messageText;

    describe('#postMessage(message_text, channel_id)', () => {
        const submission = {
            title: 'title of reported bug',
            description: 'description of problem',
            expected: 'expected outcome ',
            currently: 'current state'
        };
        const user = {
            id: 'UHAV00MD0',
            name: 'joe_wick'
        };
        const request_type = 'bug';
        const message_text = messageText(submission, user, request_type);
        const channel_id = 'foo-channel-id';

        it('returns a Promise that resolves to SlackMessage', (done) => {
            expect.assertions(1);
            nock('https://slack.com')
                .post('/api/chat.postMessage')
                .reply(200, postMsgResponse);

            slack.postMessage(message_text, channel_id)
                .then((res) => {
                    expect(res).toEqual(slack_message);
                    done();
                });
        });

        describe('failure', () => {
            it('it log the failure and returns error response', (done) => {
                expect.assertions(3);
                nock('https://slack.com')
                    .post('/api/chat.postMessage')
                    .reply(200, { ok: false });

                slack.postMessage(message_text, channel_id)
                    .catch((res) => {
                        // expect(res).toEqual({ ok: false });
                        expect(res instanceof Error).toEqual(true);
                        expect(loggerSpy).toHaveBeenCalled();
                        const logger_call = loggerSpy.mock.calls[0].toString();
                        expect(logger_call).toEqual(
                            expect.stringContaining('postMessage')
                        );
                        done();
                    });
            });
        });

        describe('data request', () => {
            const submission = {
                title: 'Very important title',
                description: 'Please provide some data',
            };
            const request_type = 'data';
            const message_text = messageText(submission, user, request_type);

            it('returns a Promise that resolves to SlackMessage', (done) => {
                expect.assertions(1);
                nock('https://slack.com')
                    .post('/api/chat.postMessage', new RegExp('data'))
                    .reply(200, postMsgResponse);

                slack.postMessage(message_text, channel_id)
                    .then((res) => {
                        expect(res).toEqual(slack_message);
                        done();
                    });
            });
        });
    });

    describe('#userName(id)', () => {
        const getUserInfo = fixture('slack/users.info.response');

        it('returns a Promise that resolves to as string', (done) => {
            expect.assertions(1);
            nock('https://slack.com')
                .post('/api/users.info')
                .reply(200, getUserInfo);

            slack.userName('W012A3CDE')
                .then((res) => {
                    expect(res).toEqual('Egon Spengler');
                    done();
                });
        });
    });

    describe('#showModalView(modal, trigger_id)', () => {
        it('returns a Promise', (done) => {
            const modal = {
                'type': 'modal' as const,
                'title': {
                    'type': 'plain_text' as const,
                    'text': 'Just a modal'
                },
                'blocks': [
                    {
                        'type': 'section',
                        'block_id': 'section-identifier',
                        'text': {
                            'type': 'mrkdwn',
                            'text': '*Welcome* to ~my~ Block Kit _modal_!'
                        }
                    }
                ],
            };
            const trigger_id = 'bar';
            expect.assertions(1);
            nock('https://slack.com')
                .post('/api/views.open')
                .reply(200, { ok: true });

            slack.showModalView(modal, trigger_id)
                .then((res) => {
                    expect(res.ok).toEqual(true);
                    done();
                });
        });
    });

    describe('#fileInfo(id)', () => {
        const file_id = 'F123';
        const getUserInfo = fixture('slack/users.info.response');
        const file_info = fixture('slack/files.info');

        it('returns object', (done) => {
            expect.assertions(1);

            nock('https://slack.com')
                .post('/api/users.info')
                .reply(200, getUserInfo);

            nock('https://slack.com')
                .post('/api/files.info')
                .reply(200, file_info);

            slack.fileInfo(file_id)
                .then((res) => {
                    expect(res).toEqual(
                        expect.objectContaining({
                            id: expect.any(String),
                            thumb_360: expect.any(String),
                            permalink: expect.any(String),
                            permalink_public: expect.any(String),
                            url_private: expect.any(String),
                            url_private_download: expect.any(String)
                        })
                    );
                    done();
                }).catch(() => {
                    done();
                });
        });

        describe('when request to fetch file info fail', () => {
            it('throws an error', (done) => {
                expect.assertions(1);

                nock('https://slack.com')
                    .post('/api/files.info')
                    .reply(200, {
                        'ok': false,
                        'error': 'invalid_auth'
                    });

                slack.fileInfo(file_id)
                    .then(() => {
                        done();
                    }).catch((err) => {
                        expect(err.message).toContain('invalid_auth');
                        done();
                    });
            });
        });
    });
});
