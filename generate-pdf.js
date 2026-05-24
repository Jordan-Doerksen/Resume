const express = require('express');
const puppeteer = require('puppeteer');

async function run() {
  const app = express();
  app.use(express.static(process.cwd()));

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/`;
    console.log('Serving', process.cwd(), 'on', url);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait until the resume content is rendered (kicker contains a name)
      await page.waitForFunction(() => {
        const el = document.querySelector('.kicker');
        return el && el.textContent.trim().length > 0;
      }, { timeout: 10000 });

      // Remove interactive elements and convert links to plain text to avoid hyperlinks in PDF
      await page.evaluate(() => {
        // remove navigation, theme toggle and download button
        document.querySelectorAll('.theme-toggle, .nav, .download-btn').forEach(el => el.remove());
        // replace all anchors with plain text
        document.querySelectorAll('a').forEach(a => {
          const span = document.createElement('span');
          span.textContent = a.textContent || a.href;
          a.replaceWith(span);
        });
        // mark single-page mode
        document.body.classList.add('single-page');
      });

      // wait for fonts to load
      await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve());

      // measure the height of the content we want to render
      const contentHeight = await page.evaluate(() => {
        const el = document.querySelector('.wrap') || document.body;
        return Math.ceil(el.scrollHeight || el.offsetHeight || document.body.scrollHeight);
      });

      // Render a single long page PDF by specifying height in px
      const pdfPath = 'Jordan-Doerksen-Resume-long.pdf';
      await page.pdf({
        path: pdfPath,
        printBackground: true,
        width: '210mm',
        height: `${contentHeight}px`,
        pageRanges: ''
      });

      console.log('Saved PDF to', pdfPath);
      await browser.close();
      server.close();
    } catch (err) {
      console.error('Error generating PDF:', err);
      await browser.close();
      server.close();
      process.exit(1);
    }
  });
}

run();
