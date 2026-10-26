# End-to-end flows

Playwright scripts that drive the deployed system as real users. They **change data** (they clear fees, submit and approve
transfers, upload a logo), so run them against a test environment or with test accounts only.

```
export E2E_CREDS=/path/to/creds.json      # [{ "role": "debtor_officer", "email": "...", "pw": "..." }, ...] - never commit this file
export E2E_BASE_URL=https://vtcsystem.app  # optional
npm i --no-save playwright
node e2e/e2e_fee.js                        # debtor officer clears an application fee: a nine-digit trainee number is issued
node e2e/e2e_tr.js submit|hot|hots|retry|view   # transfer: trainee asks, Head of Training, Head of Trainee Support, retry
node e2e/e2e_por.js <tag>                  # registration officer prints a proof of registration (writes por_<tag>.html/pdf)
node e2e/e2e_tpor.js                       # trainee prints their own proof
node e2e/e2e_admin.js                      # Organization Admin uploads a logo (see logo.js) and saves the settings
node e2e/e2e_rpc.js <role> <rpc>:<registration id> ...   # calls the proof functions directly to check who is refused
node e2e/e2e_pa.js                         # PA to the Centre Manager keeps the office registers
```

The scripts contain the record ids of the test data they were written against; edit those for another environment.
The database behaviour is covered separately by `npm run test:db` (see `supabase/tests`), which also runs in CI.
