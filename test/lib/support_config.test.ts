import supportConfig from '../../src/lib/support_config';
import feature from '../../src/util/feature';

describe('supportConfig', () => {
    const slack_user = { id: 'foo-user-id', name: 'Joe Doe' };

    describe('default', () => {
        const config = supportConfig('default');
        it('exists', () => {
            expect(config).toBeDefined();
        });
    });

    describe('syft', () => {
        const config = supportConfig('syft');
        it('exists', () => {
            expect(config).toBeDefined();
        });

        describe('#issueParams(submission, slack_user, request_type)', () => {
            describe('bug', () => {
                const request_type = 'bug';
                const submission = {
                    title: 'Test A',
                    description: 'Test B',
                    currently: 'Test C',
                    expected: 'Test D',
                    component: 'Test E',
                    region: 'Test L',
                    version: 'Test F',
                    employer: 'Test G',
                    worker: 'Test H',
                    listing: 'Test I',
                    shift: 'Test J',
                    test_data: 'Test K',
                    device: 'Test M',
                    urgency: 'Test N'
                };
                const desc = `${submission.description}

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

Submitted by: ${slack_user.name}`;

                it('matches expected object', () => {
                    expect(
                        config.issueParams(submission, slack_user, request_type)
                    ).toEqual({
                        fields: {
                            project: { key: 'SUP' },
                            summary: submission.title,
                            issuetype: { name: 'Bug' },
                            description: desc,
                            labels: ['support']
                        }
                    });
                });
            });

            describe('data', () => {
                const request_type = 'data';
                const submission = {
                    title: 'Test A',
                    description: 'Test B',
                    reason: 'Test C',
                    urgency: 'Test D',
                    region: 'Test L'
                };
                const desc = `${submission.description}

Reason:
${submission.reason}

Urgency: ${submission.urgency}
Region/Country: ${submission.region}

Submitted by: ${slack_user.name}`;

                it('matches expected object', () => {
                    expect(
                        config.issueParams(submission, slack_user, request_type)
                    ).toEqual({
                        fields: {
                            project: { key: 'SUP' },
                            summary: submission.title,
                            issuetype: { name: 'Data Request' },
                            description: desc,
                            components: [{ name: 'Back-end' }],
                            labels: ['support']
                        }
                    });
                });
            });

            describe('when long title', () => {
                const request_type = 'data';
                const long_title = 'few random words repeated many times'.repeat(10);
                const submission = {
                    title: long_title,
                    description: 'Test B',
                    reason: '',
                    urgency: 'Test D',
                    region: 'UK'
                };
                const first_part_of_title = long_title.slice(0, 128);
                const second_part_of_title = long_title.slice(128, -1);
                const desc = `${second_part_of_title}

${submission.description}

Reason:


Urgency: ${submission.urgency}
Region/Country: ${submission.region}

Submitted by: ${slack_user.name}`;
                it('slice the title to acceptable length and prepend to description', () => {
                    expect(
                        config.issueParams(submission, slack_user, request_type)
                    ).toEqual({
                        fields: {
                            project: { key: 'SUP' },
                            summary: first_part_of_title,
                            issuetype: { name: 'Data Request' },
                            description: desc,
                            components: [{ name: 'Back-end' }],
                            labels: ['support']
                        }
                    });
                });

            });
        });

        describe('#messageText(submission, user, request_type)', () => {
            describe('data', () => {
                const request_type = 'data';
                const submission = {
                    title: 'Test title',
                    description: 'Test description',
                    reason: 'Test reason',
                    urgency: 'Test urgency'
                };

                it('returns a string', () => {
                    const result = config.messageText(submission, slack_user, request_type);
                    expect(result).toContain('*Test title*');
                    expect(result).toContain('Test description');
                    expect(result).toContain('Test reason');
                    expect(result).toContain('Test urgency');
                });
            });

            describe('bug', () => {
                const request_type = 'bug';
                const submission = {
                    title: 'Test title',
                    description: 'Test description',
                    currently: 'Test currently',
                    expected: 'Test expected',
                    component: 'Component/Platform',
                    version: 'App version',
                    employer: 'Employer ID',
                    worker: 'Worker ID',
                    listing: 'Listing ID',
                    shift: 'Shift ID',
                    test_data: 'Test data',
                    region: 'Region/Country',
                    device: 'Device',
                    urgency: 'Test O'
                };

                it('returns a string', () => {
                    const result = config.messageText(submission, slack_user, request_type);

                    Object.values(submission)
                        .forEach((value: string) => {
                            expect(result).toContain(value);
                        });
                });

                describe('when bug_report_with_product_area_select_box feature is enabled', () => {
                    const submission = {
                        title: 'Test title',
                        description: 'Test description',
                        currently: 'Test currently',
                        expected: 'Test expected',
                        product_area: 'Other',
                        component: 'Component/Platform',
                        version: 'App version',
                        employer: 'Employer ID',
                        worker: 'Worker ID',
                        listing: 'Listing ID',
                        shift: 'Shift ID',
                        test_data: 'Test data',
                        region: 'Region/Country',
                        device: 'Device',
                        urgency: 'Test O'
                    };
    
                    it('returns a string', () => {
                        const featureSpy = jest.spyOn(feature, 'is_enabled');
                        featureSpy.mockImplementationOnce(() => true);

                        const result = config.messageText(submission, slack_user, request_type);
    
                        Object.values(submission)
                            .forEach((value: string) => {
                                expect(result).toContain(value);
                            });
                    });
                });
            });
        });

        describe('#view(key)', () => {
            it('returns json modal definition', () => {
                const result = config.view('bug');

                expect(
                    new Set(Object.keys(result))
                ).toEqual(new Set(['title', 'type', 'blocks', 'submit', 'private_metadata']));

                const blocks_ids = result.blocks.map((block) => { return block.block_id; });

                expect(
                    new Set(blocks_ids)
                ).toEqual(new Set([
                    'sl_title_block',
                    'ml_description_block',
                    'sl_currently_block',
                    'sl_expected_block',
                    'ss_urgency_block',
                    'ms_component_block',
                    'ss_region_block',
                    'sl_version_block',
                    'sl_employer_block',
                    'sl_worker_block',
                    'sl_listing_block',
                    'sl_shift_block',
                    'sl_test_data_block',
                    'ss_device_block',
                    'ss_urgency_block'
                ]));
            });

            describe('when bug_report_with_product_area_select_box feature view is used', () => {
                it('returns json modal definition with the domain input field', () => {
                    const featureSpy = jest.spyOn(feature, 'is_enabled');
                    featureSpy.mockImplementationOnce(() => true);
                    const result = config.view('bug');
    
                    expect(
                        new Set(Object.keys(result))
                    ).toEqual(new Set(['title', 'type', 'blocks', 'submit', 'private_metadata']));
    
                    const blocks_ids = result.blocks.map((block) => { return block.block_id; });
    
                    expect(
                        new Set(blocks_ids)
                    ).toEqual(new Set([
                        'sl_title_block',
                        'ml_description_block',
                        'sl_currently_block',
                        'sl_expected_block',
                        'ss_urgency_block',
                        'ms_component_block',
                        'ss_region_block',
                        'sl_version_block',
                        'sl_employer_block',
                        'sl_worker_block',
                        'sl_listing_block',
                        'sl_shift_block',
                        'sl_test_data_block',
                        'ss_device_block',
                        'ss_product_area_block',
                        'ss_urgency_block'
                    ]));
                });
            });
        });

        describe('#commandsHelpText()', () => {
            const expected_text =
                '👋 Need help with support bot?\n\n'
                + '> Submit a request for data:\n>`/support data`\n\n'
                + '> Submit a bug report:\n>`/support bug`';

            it('matches expected text', () => {
                expect(config.commandsHelpText()).toEqual(expected_text);
            });
        });
    });
});
