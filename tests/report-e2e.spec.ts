import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import path from "path";
import fs from "fs";
import os from "os";

const CONTRACT_TEXT = [
  "SERVICES AGREEMENT",
  "",
  "This agreement shall automatically renew for successive twelve-month periods",
  "unless the subscriber provides written notice of cancellation not fewer than",
  "sixty (60) days prior to the renewal date.",
  "",
  "In no event shall the Provider's aggregate liability exceed the total fees",
  "paid by the Subscriber during the twelve (12) months immediately preceding",
  "the claim.",
].join("\n");

let testPdfPath: string;

test.beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  let y = 750;
  for (const line of CONTRACT_TEXT.split("\n")) {
    page.drawText(line, { x: 50, y, size: 10, font });
    y -= 14;
  }
  const pdfBytes = await doc.save();

  testPdfPath = path.join(os.tmpdir(), "plainterms-test.pdf");
  fs.writeFileSync(testPdfPath, pdfBytes);
});

test.afterAll(() => {
  if (testPdfPath && fs.existsSync(testPdfPath)) {
    fs.unlinkSync(testPdfPath);
  }
});

test("upload PDF, analyze, generate report, view report page", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await page.goto("/analyze");
  await expect(page.getByPlaceholder(/paste your contract/i)).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(testPdfPath);

  const analyzeBtn = page.getByRole("button", { name: /^analyze$/i });
  await expect(analyzeBtn).toBeEnabled();
  await analyzeBtn.click();

  const parsedPanel = page.getByText(/parsed .* characters/i);
  await expect(parsedPanel).toBeVisible({ timeout: 15_000 });

  const generateBtn = page.getByRole("button", { name: /generate report/i });
  await expect(generateBtn).toBeVisible();
  await generateBtn.click();

  await page.waitForURL(/\/report\/[0-9a-f-]+/, { timeout: 30_000 });

  await expect(
    page.getByRole("heading", { name: /clauses? .* reviewing|clauses? need your attention/i }),
  ).toBeVisible({ timeout: 10_000 });
});
