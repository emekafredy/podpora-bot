import nock from 'nock';
import { Logger } from 'winston';
import { fixture } from '../helpers';
import logger from '../../src/util/logger';
import {
    Jira,
} from '../../src/lib/jira';
import {
    CreatedIssue
} from '../../src/lib/jira/api_interfaces';

const logErrorSpy = jest.spyOn(logger, 'error').mockReturnValue({} as Logger);
const createIssueResponse = fixture('jira/issues.createIssue.response');

afterEach(() => {
    jest.clearAllMocks();
});

describe('Jira', () => {
    const mock_config = {
        username: 'some name',
        api_token: 'abc-123',
        host: 'http://example.com'
    };
    const jira = new Jira(mock_config);
    const issue = createIssueResponse as unknown as CreatedIssue;

    describe('#createIssue(params)', () => {
        const params = {
            fields: {
                project: { key: 'SUP' },
                summary: 'Sample Summary',
                issuetype: { name: 'Bug' },
                description: 'Sample Description',
                labels: ['some-label'],
                components: [{ name: 'Backend' }, { name: 'ACP' }]
            }
        };

        it('returns a Promise that resolves to issue object', (done) => {
            let api_call_body: string;
            expect.assertions(7);
            nock(mock_config.host)
                .post('/rest/api/2/issue', (body) => {
                    api_call_body = JSON.stringify(body);
                    return body;
                }).reply(200, createIssueResponse);

            jira.createIssue(params)
                .then((res) => {
                    expect(res).toEqual(issue);
                    expect(api_call_body).toContain('Sample Summary');
                    expect(api_call_body).toContain('Sample Description');
                    expect(api_call_body).toContain('some-label');
                    expect(api_call_body).toContain('Bug');
                    expect(api_call_body).toContain('Backend');
                    expect(api_call_body).toContain('ACP');
                    done();
                }).catch(done);
        });

        describe('API failure', () => {
            it('it catch and log the failure', (done) => {
                const loggerSpy = jest.spyOn(logger, 'error')
                    .mockReturnValue({} as Logger);
                expect.assertions(3);

                nock(mock_config.host)
                    .post('/rest/api/2/issue')
                    .reply(403, { ok: false });

                jira.createIssue(params)
                    .catch((res) => {
                        expect(loggerSpy).toHaveBeenCalled();
                        const logger_call = loggerSpy.mock.calls[0].toString();
                        expect(logger_call).toEqual(
                            expect.stringContaining('createIssue')
                        );
                        expect(res).toEqual({ ok: false });
                        done();
                    });
            });
        });
    });

    describe('#addSlackThreadUrlToIssue(url, issue)', () => {
        const url = 'some random url';

        it('returns promise', (done) => {
            expect.assertions(1);
            nock(mock_config.host)
                .post(
                    `/rest/api/2/issue/${issue.key}/remotelink`
                ).reply(200, { foo: 123 });

            jira.addSlackThreadUrlToIssue(url, issue)
                .then((res) => {
                    expect(res).toEqual({ foo: 123 });
                    done();
                });
        });

        describe('api failure', () => {
            it('returns promise that rejects', (done) => {
                expect.assertions(2);
                nock(mock_config.host)
                    .post(
                        `/rest/api/2/issue/${issue.key}/remotelink`
                    ).reply(403, { ok: false });

                jira.addSlackThreadUrlToIssue(url, issue)
                    .catch((res) => {
                        expect(res).toEqual({ ok: false });
                        expect(logErrorSpy).toHaveBeenCalled();
                        done();
                    });
            });
        });
    });

    describe('#issueUrl(issue)', () => {
        it('returns url to jira issue on host domain', () => {
            const url = jira.issueUrl(issue);

            expect(url).toEqual(`${mock_config.host}/browse/${issue.key}`);
        });
    });

    describe('#addComment(issue_key, comment)', () => {
        it('logs the error', (done) => {
            expect.assertions(4);
            nock('https://example.com')
                .post('/rest/api/2/issue/issue-key/comment')
                .reply(404);


            jira.addComment('issue-key', 'comment')
                .then((res) => {
                    expect(res).toEqual({ ok: false });
                    expect(logErrorSpy).toHaveBeenCalled();
                    const logger_call = logErrorSpy.mock.calls[0].toString();
                    expect(logger_call).toContain('issue-key');
                    expect(logger_call).toContain('addComment');

                    done();
                });
        });
    });

    describe('#find(id)', () => {
        it('logs the error', (done) => {
            expect.assertions(4);
            nock('https://example.com')
                .get('/rest/agile/1.0/issue/123')
                .reply(404);

            jira.find(123)
                .catch((res) => {
                    expect(res).toEqual({ ok: false });
                    expect(logErrorSpy).toHaveBeenCalled();
                    const logger_call = logErrorSpy.mock.calls[0].toString();
                    expect(logger_call).toContain('123');
                    expect(logger_call).toContain('find');
                    done();
                });
        });
    });
});
