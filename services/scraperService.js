const cheerio = require("cheerio");
const puppeteerExtra = require("puppeteer-extra");
const stealthPlugin = require("puppeteer-extra-plugin-stealth");
const chromium = require("@sparticuz/chromium");
const Lead = require("../models/Lead");
const { scrapeData } = require("./websiteScrapping");

async function searchGoogleMaps(project, io) {
  try {
    const start = Date.now();

    puppeteerExtra.use(stealthPlugin());

    const browser = await puppeteerExtra.launch({
      args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--single-process'
  ],
  executablePath: await chromium.executablePath(), 
  headless: true,
  defaultViewport: chromium.defaultViewport,
    });
console.log('Chromium Path:', await chromium.executablePath());
    const page = await browser.newPage();

    const { city, businessCategory } = project;
    const query = `${businessCategory} ${city}`;
    console.log(
      `Navigating: https://www.google.com/maps/search/${query
        .split(" ")
        .join("+")}`
    );
    try {
      await page.goto(
        `https://www.google.com/maps/search/${query.split(" ").join("+")}`
      );
    } catch (error) {
      console.log("Error navigating to the page");
    }

    async function autoScroll(page) {
      await page.evaluate(async () => {
        const wrapper = document.querySelector('div[role="feed"]');
        await new Promise((resolve) => {
          var totalHeight = 0;
          var distance = 1000;
          var scrollDelay = 8000;
          var timer = setInterval(async () => {
            var scrollHeightBefore = wrapper.scrollHeight;
            wrapper.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeightBefore) {
              totalHeight = 0;
              await new Promise((resolve) => setTimeout(resolve, scrollDelay));

              var scrollHeightAfter = wrapper.scrollHeight;
              if (scrollHeightAfter > scrollHeightBefore) {
                return;
              } else {
                clearInterval(timer);
                resolve();
              }
            }
          }, 200);
        });
      });
    }

    await autoScroll(page);

    const html = await page.content();
    const pages = await browser.pages();
    await Promise.all(pages.map((page) => page.close()));

    await browser.close();
    console.log("Browser closed");

    const $ = cheerio.load(html);
    const aTags = $("a");
    const parents = [];
    aTags.each((i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      if (href.includes("/maps/place/")) {
        parents.push($(el).parent());
      }
    });

    console.log("Number of parents:", parents.length);

    const businesses = [];
    const { vendorId } = project;

    parents.forEach((parent) => {
      const url = parent.find("a").attr("href");
      const website = parent.find('a[data-value="Website"]').attr("href");
      const storeName = parent.find("div.fontHeadlineSmall").text();
      const ratingText = parent
        .find("span.fontBodyMedium > span")
        .attr("aria-label");

      const bodyDiv = parent.find("div.fontBodyMedium").first();
      const children = bodyDiv.children();
      const lastChild = children.last();
      const firstOfLast = lastChild.children().first();
      const lastOfLast = lastChild.children().last();

      const imageUrl = parent.find("img").attr("src");

      businesses.push({
        placeId: `ChI${url?.split("?")?.[0]?.split("ChI")?.[1]}`,
        address: firstOfLast?.text(),
        category: firstOfLast?.text()?.split("·")?.[0]?.trim(),
        projectCategory: businessCategory,
        phone: lastOfLast?.text()?.split("·")?.[1]?.trim(),
        googleUrl: url,
        bizWebsite: website,
        storeName,
        ratingText,
        imageUrl,
        vendorId,
        stars: ratingText?.split("stars")?.[0]?.trim()
          ? Number(ratingText?.split("stars")?.[0]?.trim())
          : null,
        numberOfReviews: ratingText
          ?.split("stars")?.[1]
          ?.replace("Reviews", "")
          ?.trim()
          ? Number(
              ratingText?.split("stars")?.[1]?.replace("Reviews", "")?.trim()
            )
          : null,
      });
    });

    const end = Date.now();
    console.log(`Time taken: ${Math.floor((end - start) / 1000)} seconds`);

    async function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function processBusinesses(businesses) {
      const concurrencyLimit = 3;
      const batchResults = [];

      try {
        for (let i = 0; i < businesses.length; i += concurrencyLimit) {
          const batch = businesses.slice(i, i + concurrencyLimit);

          const results = await Promise.all(
            batch.map(async (data) => {
              if (data.bizWebsite) {
                const websiteDetails = await scrapeData(data.bizWebsite);
                return {
                  ...data,
                  websiteDetails: {
                    about: websiteDetails.about || "",
                    logoUrl: websiteDetails.logoUrl || "",
                    email: websiteDetails.email || "",
                    socialLinks: {
                      youtube: websiteDetails.socialLinks?.youtube || "",
                      instagram: websiteDetails.socialLinks?.instagram || "",
                      facebook: websiteDetails.socialLinks?.facebook || "",
                      linkedin: websiteDetails.socialLinks?.linkedin || "",
                    },
                    images: websiteDetails.images || [],
                  },
                };
              }
              return data;
            })
          );
          io.emit("batchUpdate", results);
          batchResults.push(...results);
          await delay(5000); // 5-second delay between batches
        }

        // Prepare data for database insertion
        const leadsToSave = batchResults.map((business) => ({
          ...business,
          about: business.websiteDetails?.about || "",
          logoUrl: business.websiteDetails?.logoUrl || "",
          email: business.websiteDetails?.email || "",
          socialLinks: {
            youtube: business.websiteDetails?.socialLinks?.youtube || "",
            instagram: business.websiteDetails?.socialLinks?.instagram || "",
            facebook: business.websiteDetails?.socialLinks?.facebook || "",
            linkedin: business.websiteDetails?.socialLinks?.linkedin || "",
          },
          images: business.websiteDetails?.images || [],
        }));

        // Save the data into MongoDB
        await Lead.insertMany(leadsToSave);
        io.emit("scrapingComplete", { message: "Data added successfully" });

        return batchResults;
      } catch (error) {
        console.error("Error in processBusinesses:", error.message);
        io.emit("scrapingError", { message: error.message });
        throw error; // Ensure error propagation for debugging
      }
    }

    // Process the businesses
    const result = await processBusinesses(businesses);
    console.log("result", result.splice(0, 10));
    return result;
  } catch (error) {
    console.error("Error in searchGoogleMaps:", error.message);
  }
}

module.exports = { searchGoogleMaps };
