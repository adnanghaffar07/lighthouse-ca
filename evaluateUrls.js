import {
  createBrowser,
  createReportWithBrowser,
  generatePDF,
  sendEmail,
  uploadFile,
  zipDirectory,
} from "./lighthouse-util.js";
import "dotenv/config.js";
import fs from "fs";
import { DOMParser } from "xmldom";
import fetch from "node-fetch";

(async () => {
  const siteMap = process.env.SITE_MAP_AVAILABLE;
  let urlsString;
  let urls = [];
  let reportResults;

  const browser = await createBrowser();

  if (siteMap === "true" || siteMap === "True" || siteMap === "TRUE") {
    const siteMapURl = process.env.SITE_MAP_URL;
    if (!siteMapURl) {
      throw new Error("SITE_MAP_URL is required");
    }
    const xmlResponse = await fetch(siteMapURl);
    const xmlContent = await xmlResponse.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "text/xml");

    // Get all 'loc' elements using XPath
    const locElements = doc.getElementsByTagName("loc");
    urls = Array.from(locElements).map((locElement) =>
      locElement.textContent.trim()
    );
  } else {
    urlsString = process.env.URLS_TO_EVALUATE;
    if (!urlsString) {
      throw new Error("URLS_TO_EVALUATE is need when sitemap is false");
    }
    urls = urlsString.split(",");
  }
  if (!fs.existsSync("results")) {
    fs.mkdirSync("results");
  }
  if (!fs.existsSync("results/htmlreports")) {
    fs.mkdirSync("results/htmlreports");
  }
  if (!fs.existsSync("results/pdfReports")) {
    fs.mkdirSync("results/pdfReports");
  }

  const htmlFiles = fs.readdirSync("results/htmlReports");
  const pdfFiles = fs.readdirSync("results/pdfReports");

  for (const htmlFile of htmlFiles) {
    if (htmlFile.endsWith(".html")) {
      fs.unlinkSync(`results/htmlreports/${htmlFile}`);
      console.log(`Removed previous HTML report: ${htmlFile}`);
    }
  }

  for (const pdfFile of pdfFiles) {
    if (pdfFile.endsWith(".pdf")) {
      fs.unlinkSync(`results/pdfreports/${pdfFile}`);
      console.log(`Removed previous PDF report: ${pdfFile}`);
    }
  }

  for (const url of urls) {
    console.log("Evaluating: ", url);
    const result = await createReportWithBrowser(browser, url, {
      output: "html",
    });
    if (result.report) {
      reportResults = result.lhr;
      console.log("Report generated successfully!");
      const filename = url.replace(/[^a-zA-Z0-9]/g, "_") + ".html";
      fs.writeFileSync(
        `results/htmlReports/${filename}`,
        result.report,
        "utf-8"
      );
      const pdfPath = url.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf";
      await generatePDF(
        `results/htmlReports/${filename}`,
        `results/pdfReports/${pdfPath}`
      );
      console.log("Results saved to results folder");
    } else {
      throw new Error(`No report generated for URL: ${url}`);
    }
  }
  await browser.close();
  if (reportResults) {
    console.log("My Results", reportResults.categories);
    await zipDirectory("results", "results.zip");
    const reportLink = await uploadFile();
    await sendEmail(reportLink, reportResults.categories);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
