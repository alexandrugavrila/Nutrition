// Production-image HTTPS smoke. Credentials are environment-only and never printed.
const { chromium } = require('../Frontend/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const origin = process.env.RELEASE_HTTPS_ORIGIN;
  assert(origin?.startsWith('https://'), 'HTTPS origin required');
  const local = process.env.RELEASE_LOCAL_CERT === '1';
  assert(!local || new URL(origin).hostname === 'localhost', 'Local certificate exception only for localhost rehearsal');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: local });
    const page = await context.newPage();
    await page.goto(origin);
    for (const email of [process.env.RELEASE_USER_A, process.env.RELEASE_USER_B, process.env.RELEASE_USER_A]) {
      assert(email && process.env.RELEASE_PASSWORD, 'Dedicated smoke accounts and password required');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(process.env.RELEASE_PASSWORD);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Log out', exact: true }).waitFor();
      const cookies = await context.cookies();
      assert(cookies.some(c => c.secure && c.httpOnly && c.sameSite === 'Lax'), 'Secure HttpOnly session cookie required');
      const status = await page.evaluate(async () => (await fetch('/api/auth/me')).json());
      assert.equal(status.user.email, email);
      const response = await context.request.get(origin + '/api/ingredients/' + process.env.RELEASE_INGREDIENT_ID);
      assert.equal(response.status(), email === process.env.RELEASE_USER_A ? 200 : 404);
      await page.reload();
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await page.getByLabel('Email').waitFor();
      assert.equal((await context.request.get(origin + '/api/ingredients/')).status(), 401);
    }
    await context.close();
    console.log('HTTPS browser smoke passed: secure cookies, login, reload, A/B/A isolation, logout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
