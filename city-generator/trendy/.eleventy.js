module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

  // Serialises minimal trending data for the home page sidebar JS.
  // Returns a JSON string: [{name, slug, venues:[{name,location,score,viral,tiktok}]}]
  eleventyConfig.addFilter("trendingData", function (cities) {
    return JSON.stringify(
      (cities || []).map(function (c) {
        return {
          name:   c.name,
          slug:   c.slug,
          venues: (c.venues || []).slice(0, 3).map(function (v) {
            return {
              name:     v.name,
              location: v.location,
              score:    v.ranking_score,
              viral:    v.viral || false,
              tiktok:   (v.trend_signals && v.trend_signals.tiktok_mentions) || 0,
            };
          }),
        };
      })
    );
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
