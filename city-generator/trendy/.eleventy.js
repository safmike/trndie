module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

  // Serialises minimal trending data for the home page sidebar JS,
  // sourced from the v2.1 rankedCities bridge.
  eleventyConfig.addFilter("trendingData", function (cities) {
    return JSON.stringify(
      (cities || []).map(function (c) {
        return {
          name:   c.name,
          slug:   c.slug,
          venues: (c.venues || []).slice(0, 3).map(function (v) {
            return {
              name:     v.venue_name,
              location: v.suburb,
              vibe:     (v.vibe_tags && v.vibe_tags[0]) || "",
            };
          }),
        };
      })
    );
  });

  // Flattens rankedCities into a single venue array, sorted by
  // composite_score desc. Annotates each venue with cityName/citySlug
  // so the All Venues template can render city context per card.
  eleventyConfig.addFilter("allVenuesFlat", function (cities) {
    var all = [];
    (cities || []).forEach(function (c) {
      (c.venues || []).forEach(function (v) {
        all.push(Object.assign({}, v, {
          cityName: c.name,
          citySlug: c.slug,
        }));
      });
    });
    all.sort(function (a, b) {
      return (b.composite_score || 0) - (a.composite_score || 0);
    });
    return all;
  });

  // Returns a de-duplicated array of the values of `key` across an array of objects.
  // Usage: collection | uniqueBy("category")  →  ["cafe", "bakery", "deli"]
  // Flattens an array of city objects into a single array of all their venues.
  // Usage: cities | flatVenues  →  [venue, venue, ...]
  eleventyConfig.addFilter("flatVenues", function (cities) {
    return (cities || []).flatMap(function (c) { return c.venues || []; });
  });

  eleventyConfig.addFilter("uniqueBy", function (arr, key) {
    var seen = new Set();
    return (arr || []).reduce(function (acc, item) {
      var v = item[key];
      if (!seen.has(v)) { seen.add(v); acc.push(v); }
      return acc;
    }, []);
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};
