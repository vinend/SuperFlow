# Sample investment and investigation submissions

Run `npm run stg:samples` after base setup and migrations to add twelve
clearly labeled synthetic submissions to the configured database. This command
does not reset documents, chats or existing work. It runs transactionally and
preserves sample edits and decisions on repeat runs. It does not approve anything.

| Sample | Submitter workspace | Reviewer identity |
| --- | --- | --- |
| Operations automation: IDR 120 million investment; IDR 45 million annual net inflow for four years | Finance → Investment Analysis | Manager |
| Security monitoring upgrade: IDR 350 million investment; IDR 120 million annual net inflow for four years | Finance → Investment Analysis | Governance (sample investment committee) |
| SAMPLE-AML-001: complete synthetic evidence and analyst recommendation | Compliance → Investigation Review | Compliance Checker |
| SAMPLE-AML-002: conflicting source-of-funds evidence explicitly retained | Compliance → Investigation Review | Compliance Checker |
| Customer service tooling: IDR 90 million; IDR 32 million annual inflow | Finance → Investment Analysis | Manager |
| Management reporting: IDR 240 million; IDR 85 million annual inflow | Finance → Investment Analysis | Manager |
| Disaster recovery: IDR 600 million; IDR 190 million annual inflow | Finance → Investment Analysis | Governance |
| Archive replacement: IDR 180 million; IDR 35 million annual inflow | Finance → Investment Analysis | Manager |
| SAMPLE-AML-003 and 004: additional complete/conflicting scenarios | Compliance → Investigation Review | Compliance Checker |
| SAMPLE-AML-005 and 006: failed evidence scenarios | Compliance → Investigation Review | Blocked; not submitted |

All investments use a 10% discount rate, four-year term and a separate, explicitly synthetic
approval policy with a manager limit of IDR 250 million. Their source documents,
calculations and submitted memos are linked through the existing domain services.
These samples do not resolve conflicting assumptions on behalf of a user.

Switch to each reviewer identity and open **Reviews / Approvals** to inspect the
evidence and approve, reject, or request information where permitted. The
investigation analyst cannot approve their own submissions. The investigation
tools use synthetic fixtures only in the explicit local/synthetic profile. A
conflict remains REVIEW_REQUIRED rather than being silently cleared.

For password/browser staging, supply `--finance USER_ID --analyst USER_ID --prefix stg`.
This creates separate STG records owned by the supplied named accounts. The six
investment submissions await real reviewer decisions. The six investigations use
clearly labeled sample intake records and **wait for real browser collection**;
they are not automatically submitted and contain no fabricated screening output.
Collect the necessary evidence before submitting to an independent reviewer.
Repeat runs preserve existing work. The historical `demo:submissions` alias remains
available for existing scripts.

This additive command is separate from the destructive `demo:reset` presentation
reset. The command does not start the web server, API, or Ollama.
