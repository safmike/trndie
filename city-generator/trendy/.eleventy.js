module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

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
