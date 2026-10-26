import type {Page} from '@playwright/test';
export async function leaveGuide(page:Page){if(!await page.locator('[data-guide="free"]').isVisible())await page.locator('#court-tools').click();await page.locator('[data-guide="free"]').click();}
export async function discussionAction(page:Page,action:string){const button=page.locator(`[data-discuss="${action}"]`);for(let i=0;i<4&&!await button.isVisible();i++)await page.locator('[data-discuss="more"]').click();await button.click();}
