const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const tools = [
  '01-versicherungscheck',
  '02-budgetplaner',
  '03-ebook-7-fehler',
  '04-familien-uebersicht',
  '05-umzugscheckliste'
];

(async () => {
  // Start local HTTP server
  const server = require('child_process').spawn(
    'npx', ['http-server', '.', '-p', '8080', '--silent'],
    { detached: true, stdio: 'ignore' }
  );
  server.unref();
  await new Promise(r => setTimeout(r, 2000));

  const outDir = path.resolve('produkte/pdfs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Tools die Querformat brauchen
  const landscapeTools = ['01-versicherungscheck'];

  for (const tool of tools) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:8080/produkte/${tool}.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    // Wait for fonts
    await new Promise(r => setTimeout(r, 1500));
    await page.pdf({
      path: `produkte/pdfs/${tool}.pdf`,
      format: 'A4',
      landscape: landscapeTools.includes(tool),
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    console.log(`✓ ${tool}.pdf`);
    await page.close();
  }

  await browser.close();
  process.exit(0);
})();
