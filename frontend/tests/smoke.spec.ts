import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const PASSWORD = 'testpass123';

const attachDialogHandler = (page: Page) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
};

const registerUser = async (page: Page, username: string) => {
  await page.goto('/login');
  await page.getByRole('button', { name: "Don't have an account? Register" }).click();
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('Enter password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/app$/);
};

const prepareContext = async (context: BrowserContext) => {
  await context.grantPermissions(['camera', 'microphone'], { origin: 'http://127.0.0.1:4173' });
};

test('registration, DM, attachments, voice note, audio call and video call smoke flow', async ({ browser }) => {
  test.slow();

  const stamp = Date.now().toString().slice(-8);
  const userA = `codex_a_${stamp}`;
  const userB = `codex_b_${stamp}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await prepareContext(contextA);
  await prepareContext(contextB);

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  attachDialogHandler(pageA);
  attachDialogHandler(pageB);

  try {
    await registerUser(pageA, userA);
    await registerUser(pageB, userB);

    await pageA.getByTitle('Search Users').click();
    await pageA.getByPlaceholder('Search by username').fill(userB);
    await pageA.getByPlaceholder('Search by username').press('Enter');
    await expect(pageA.locator(`.result-item:has-text("${userB}")`)).toBeVisible();
    await pageA.locator(`.result-item:has-text("${userB}") .add-friend-btn`).click();
    await pageA.locator('.search-modal .close-btn').click();

    await pageB.getByText('Friend Requests').click();
    await expect(pageB.locator(`.request-item:has-text("${userA}")`)).toBeVisible({ timeout: 15000 });
    await pageB.locator(`.request-item:has-text("${userA}") .circle-green`).click();

    await pageA.getByTitle('Direct Messages').click();
    await expect(pageA.locator(`.channel-item:has-text("${userB}")`)).toBeVisible({ timeout: 20000 });
    await pageA.locator(`.channel-item:has-text("${userB}")`).click();

    await expect(pageB.locator(`.channel-item:has-text("${userA}")`)).toBeVisible({ timeout: 20000 });
    await pageB.locator(`.channel-item:has-text("${userA}")`).click();

    await pageA.locator('.chat-input').fill(`hello from ${userA}`);
    await pageA.locator('.chat-input').press('Enter');
    await expect(pageB.getByText(`hello from ${userA}`)).toBeVisible({ timeout: 15000 });

    await pageA.locator('input[type="file"]').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('attachment smoke test'),
    });
    await expect(pageB.getByText('note.txt')).toBeVisible({ timeout: 15000 });

    await pageA.getByTitle('Record voice message').click();
    await pageA.waitForTimeout(2000);
    await pageA.getByTitle('Record voice message').click();
    await expect(pageA.locator('.audio-preview-modal')).toBeVisible({ timeout: 15000 });
    await pageA.locator('.audio-preview-modal .circle-green').click();
    await expect(pageB.locator('.message-audio')).toHaveCount(1, { timeout: 15000 });

    await pageA.getByTitle('Start audio call').click();
    await expect(pageB.getByText('Incoming audio call...')).toBeVisible({ timeout: 15000 });
    await pageB.locator('.btn-call.accept').click();
    await expect(pageA.getByText(/Audio call connected/)).toBeVisible({ timeout: 20000 });
    await expect(pageB.getByText(/Audio call connected/)).toBeVisible({ timeout: 20000 });
    await pageA.locator('.btn-call.end').click();
    await expect(pageA.locator('.call-overlay')).toHaveCount(0, { timeout: 15000 });
    await expect(pageB.locator('.call-overlay')).toHaveCount(0, { timeout: 15000 });

    await pageA.getByTitle('Start video call').click();
    await expect(pageB.getByText('Incoming video call...')).toBeVisible({ timeout: 15000 });
    await pageB.locator('.btn-call.accept').click();
    await expect(pageA.getByText(/Video call connected/)).toBeVisible({ timeout: 20000 });
    await expect(pageB.getByText(/Video call connected/)).toBeVisible({ timeout: 20000 });
    await expect(pageA.locator('.call-overlay.video-call')).toBeVisible();
    await expect(pageB.locator('.call-overlay.video-call')).toBeVisible();
    await pageB.locator('.btn-call.end').click();
    await expect(pageA.locator('.call-overlay')).toHaveCount(0, { timeout: 15000 });
    await expect(pageB.locator('.call-overlay')).toHaveCount(0, { timeout: 15000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
