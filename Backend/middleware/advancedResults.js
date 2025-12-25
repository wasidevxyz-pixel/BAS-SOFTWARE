const advancedResults = (model, populate) => async (req, res, next) => {
  let query;

  // Create a copy of req.query
  const reqQuery = { ...req.query };

  // Fields to exclude from filtering
  const removeFields = ['select', 'sort', 'page', 'limit', 'search', 'startDate', 'endDate'];

  // Handle date range filtering
  if (req.query.startDate || req.query.endDate) {
    reqQuery.date = {};
    if (req.query.startDate) {
      const startDate = new Date(req.query.startDate);
      reqQuery.date.$gte = startDate.toISOString();
    }
    if (req.query.endDate) {
      // Set end date to end of day
      const endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999);
      reqQuery.date.$lte = endDate.toISOString();
    }
  }

  // Remove fields from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Store date filter separately to avoid stringify/parse issues
  const dateFilter = reqQuery.date ? { ...reqQuery.date } : null;

  // Remove date from reqQuery before stringify to avoid double $ prefix
  if (reqQuery.date) {
    delete reqQuery.date;
  }

  // Create query string for filtering
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Parse the query and add date filter back if it exists
  const parsedQuery = JSON.parse(queryStr);
  if (dateFilter) {
    parsedQuery.date = dateFilter;
  }

  // Start building the query
  query = model.find(parsedQuery);

  // Search functionality
  if (req.query.search) {
    const searchFields = model.schema.obj && model.schema.obj.$text ?
      { $text: { $search: req.query.search } } :
      {
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { sku: { $regex: req.query.search, $options: 'i' } },
          { barcode: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } },
          { invoiceNo: { $regex: req.query.search, $options: 'i' } },
          { referenceNo: { $regex: req.query.search, $options: 'i' } }
        ]
      };

    // Combine search with other filters (like date, status)
    const combinedQuery = { ...searchFields };
    if (dateFilter) {
      combinedQuery.date = dateFilter;
    }
    // Add other filters from parsedQuery
    Object.keys(parsedQuery).forEach(key => {
      if (key !== 'date' && !searchFields[key]) {
        combinedQuery[key] = parsedQuery[key];
      }
    });

    query = model.find(combinedQuery);
    queryStr = JSON.stringify(combinedQuery);
  }

  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  // Build count query (same conditions as main query)
  // Use parsedQuery which already has the date filter merged
  let countQuery = model.countDocuments(parsedQuery);

  // If search is used, count with search fields
  if (req.query.search) {
    const searchFields = model.schema.obj && model.schema.obj.$text ?
      { $text: { $search: req.query.search } } :
      {
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { sku: { $regex: req.query.search, $options: 'i' } },
          { barcode: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } },
          { invoiceNo: { $regex: req.query.search, $options: 'i' } },
          { referenceNo: { $regex: req.query.search, $options: 'i' } }
        ]
      };

    // Combine search with date filtering if present
    if (dateFilter) {
      searchFields.date = dateFilter;
    }
    // Add other filters from parsedQuery
    Object.keys(parsedQuery).forEach(key => {
      if (key !== 'date' && !searchFields[key]) {
        searchFields[key] = parsedQuery[key];
      }
    });

    countQuery = model.countDocuments(searchFields);
  }

  const total = await countQuery;

  query = query.skip(startIndex).limit(limit);

  // Populate if specified
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(p => {
        query = query.populate(p);
      });
    } else {
      query = query.populate(populate);
    }
  }

  // Execute query
  const results = await query;

  // Pagination result
  const pagination = {
    page,
    limit,
    total
  };

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.advancedResults = {
    success: true,
    count: results.length,
    pagination,
    data: results
  };

  next();
};

module.exports = advancedResults;
