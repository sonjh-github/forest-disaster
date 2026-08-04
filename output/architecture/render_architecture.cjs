const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

(async () => {
  const dir = __dirname;
  const stem = '산림재난_통합통신_관제_단계별_노드간선_아키텍처_v2.0';
  const htmlPath = path.join(dir, `${stem}.html`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--disable-gpu', '--disable-gpu-sandbox', '--disable-software-rasterizer'],
  });
  const page = await browser.newPage({ viewport: { width: 2384, height: 1684 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.join(dir, `${stem}.pdf`),
    format: 'A3',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  });
  await page.emulateMedia({ media: 'screen' });
  const sheets = page.locator('.sheet');
  const count = await sheets.count();
  for (let i = 0; i < count; i += 1) {
    await sheets.nth(i).screenshot({
      path: path.join(dir, `${stem}_${i + 1}.png`),
      animations: 'disabled',
    });
  }
  console.log(JSON.stringify({ pages: count, title: await page.title() }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
