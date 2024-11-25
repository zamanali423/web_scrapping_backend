const puppeteer = require("puppeteer");
const axios = require("axios");

async function isWebsiteAvailable(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.status === 200;
  } catch (error) {
    console.error(`Website not available: ${url}`);
    return false;
  }
}

async function scrapeData(url) {
  const browser = await puppeteer.launch({ headless: true });
  let about = "";
  let logoUrl = "";
  let email = "";
  let socialLinks = {
    youtube: "",
    instagram: "",
    facebook: "",
    linkedin: "",
  };

  // Check if website is available, if not skip the scraping process
  if (!(await isWebsiteAvailable(url))) {
    console.log(`Skipping website: ${url}`);
    await browser.close();
    return {};
  }

  try {
    const page = await browser.newPage();
    await safeNavigate(page, url, 90000); // Custom timeout of 90 seconds
    page.setDefaultTimeout(60000);

    await page.waitForSelector("body", { timeout: 60000 });

    // Scroll the page to load dynamic content
    await scrollPage(page);

    const header = await page.$("header");
    if (header) {
      logoUrl = await getLogoUrl(header);
      email = await getEmail(page);
      socialLinks = await getSocialLinks(page);
    }

    // Scroll the page to load dynamic content
    await scrollPage(page);
    if (!email || Object.values(socialLinks).some((link) => link === "")) {
      const footer = await page.$("footer");
      if (footer) {
        email = await getEmail(page);
        socialLinks = await getSocialLinks(page);
      }
    }

    // Check the Contact Us page, skip scraping if not available
    const contactUsUrl = constructContactUrl(url);
    console.log("Checking Contact Us page:", contactUsUrl);
    if (!(await isWebsiteAvailable(contactUsUrl))) {
      console.log("Skipping Contact Us page:", contactUsUrl);
    } else {
      // Scroll the page to load dynamic content
      await scrollPage(page);
      await safeNavigate(page, contactUsUrl, 90000);
      email = await getEmail(page);
      socialLinks = await getSocialLinks(page);
    }

    // Check the About Us page, skip scraping if not available
    const aboutUsUrl = constructAboutUsUrl(url);
    console.log("Checking About Us page:", aboutUsUrl);
    if (!(await isWebsiteAvailable(aboutUsUrl))) {
      console.log("Skipping About Us page:", aboutUsUrl);
    } else {
      // Scroll the page to load dynamic content
      await scrollPage(page);
      await safeNavigate(page, aboutUsUrl, 90000);
      email = await getEmail(page);
      about = await getAbout(page);
      socialLinks = await getSocialLinks(page);
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  return { logoUrl, email, socialLinks, about };
}

// Extract logo URL
async function getLogoUrl(header) {
  try {
    const logoSelector =
      'img[src*="logo"], .logo img, [class*="logo"] img, link[rel*="icon"], svg';

    const logoElement = await header.$(logoSelector);

    if (!logoElement) {
      return ""; // Return empty string if no logo found
    }

    // Handle the case for img elements
    const src = await logoElement.getProperty("src");
    if (src) {
      return await src.jsonValue(); // Extract the src value for image
    }

    // Handle the case for link rel="icon" elements
    const href = await logoElement.getProperty("href");
    if (href) {
      return await href.jsonValue(); // Extract the href value for icon
    }

    // Handle the case for SVG (if applicable)
    const svg = await logoElement.evaluate((el) => {
      if (el.tagName.toLowerCase() === "svg") {
        return el.outerHTML; // If it's an SVG, return its HTML content
      }
      return "";
    });
    if (svg) {
      return svg; // If it's an SVG, return the SVG markup (or handle it accordingly)
    }

    return ""; // Return empty if no logo found
  } catch (error) {
    console.error("Error extracting logo URL:", error);
    return "";
  }
}

async function getEmail(page) {
  try {
    return await page.evaluate(() => {
      // Try to match an email in the text content of the page
      const textContent = document.body.innerText;
      const emailMatch = textContent.match(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/
      );

      // If no email found in text, check for mailto: links
      if (!emailMatch) {
        const mailtoLink = document.querySelector("a[href^='mailto:']");
        return mailtoLink
          ? mailtoLink.getAttribute("href").replace("mailto:", "")
          : "";
      }

      // If email is found, return it
      return emailMatch ? emailMatch[0] : "";
    });
  } catch (error) {
    console.error("Error getting email:", error);
    return "";
  }
}

// Extract About Us content
async function getAbout(page) {
  try {
    return await page.evaluate(() => {
      const aboutElement =
        document.querySelector(
          'div[class*="about"], section[class*="about"], p'
        ) || null;
      return aboutElement ? aboutElement.innerText.trim() : "";
    });
  } catch {
    return "";
  }
}

async function getSocialLinks(page) {
  try {
    const socialSelectors = [
      "a[href*='facebook.com']",
      "a[href*='instagram.com']",
      "a[href*='linkedin.com']",
      "a[href*='youtube.com']",
    ];
    const links = await page.$$eval(socialSelectors.join(","), (anchors) =>
      anchors.map((a) => a.href).filter((href) => href)
    );

    // Initialize the socialLinks object with empty strings
    let socialLinks = {
      youtube: "",
      instagram: "",
      facebook: "",
      linkedin: "",
    };

    // Map found links to their respective social platforms
    links.forEach((link) => {
      if (link.includes("facebook.com")) socialLinks.facebook = link;
      if (link.includes("instagram.com")) socialLinks.instagram = link;
      if (link.includes("linkedin.com")) socialLinks.linkedin = link;
      if (link.includes("youtube.com")) socialLinks.youtube = link;
    });

    return socialLinks;
  } catch {
    return { youtube: "", instagram: "", facebook: "", linkedin: "" };
  }
}

function constructContactUrl(baseUrl) {
  const paths = [
    "/contact-us",
    "/contact",
    "/contacts",
    "/contactus",
    "/contact-us.html",
  ];
  return `${baseUrl}${paths[0]}`; // Choose only the first constructed URL
}

function constructAboutUsUrl(baseUrl) {
  const paths = [
    "/about-us",
    "/about",
    "/abouts",
    "/aboutus",
    "/about-us.html",
  ];
  return `${baseUrl}${paths[0]}`;
}

async function safeNavigate(page, url, timeout) {
  try {
    // Navigate with custom timeout to avoid hanging forever
    await page.goto(url, { waitUntil: "networkidle2", timeout });
  } catch (error) {
    console.error(`Navigation error at ${url}:`, error);
    throw new Error(`Failed to navigate to ${url} within ${timeout}ms`);
  }
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      let distance = 1000;

      const scroll = () => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight < scrollHeight) {
          setTimeout(scroll, 200);
        } else {
          resolve();
        }
      };
      scroll();
    });
  });
}

module.exports = { scrapeData };
