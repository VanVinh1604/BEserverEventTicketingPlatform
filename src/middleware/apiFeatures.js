class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // FILTER
  filter() {
  const queryObj = { ...this.queryString };
  const excluded = ["page", "sort", "limit", "fields"];
  excluded.forEach((el) => delete queryObj[el]);

  // Advanced filtering
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(
    /\b(gte|gt|lte|lt)\b/g,
    (match) => `$${match}`
  );

  this.query = this.query.find(JSON.parse(queryStr));
  return this;
  }

  // SORT
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  // PAGINATION
  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
