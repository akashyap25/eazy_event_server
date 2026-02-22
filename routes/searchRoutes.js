const express = require('express');
const router = express.Router();
const SearchService = require('../services/searchService');
const { optionalAuth } = require('../middlewares/authMiddleware');
const { setOrgContext } = require('../middlewares/organizationMiddleware');

// Search events
router.get('/events', optionalAuth, setOrgContext, async (req, res) => {
  try {
    const {
      q: query,
      category,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      location,
      status,
      tags,
      isFree,
      sortBy,
      page,
      limit
    } = req.query;

    const result = await SearchService.searchEvents({
      query,
      category,
      organizationId: req.organization?._id,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      location,
      status,
      tags,
      isFree,
      sortBy,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      visibility: req.organization ? 'organization' : 'public',
      userId: req.user?._id
    });

    res.json({
      success: true,
      data: result.events,
      pagination: result.pagination,
      filters: result.filters
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing search',
      error: error.message
    });
  }
});

// Get search suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, limit } = req.query;

    const result = await SearchService.getSuggestions(
      query,
      parseInt(limit) || 10
    );

    res.json({
      success: true,
      data: result.suggestions,
      query: result.query
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting suggestions',
      error: error.message
    });
  }
});

// Get trending events
router.get('/trending', optionalAuth, setOrgContext, async (req, res) => {
  try {
    const { limit } = req.query;

    const result = await SearchService.getTrendingEvents({
      organizationId: req.organization?._id,
      limit: parseInt(limit) || 10
    });

    res.json({
      success: true,
      data: result.events
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting trending events',
      error: error.message
    });
  }
});

// Get similar events
router.get('/similar/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { limit } = req.query;

    const result = await SearchService.getSimilarEvents(
      eventId,
      parseInt(limit) || 5
    );

    res.json({
      success: true,
      data: result.events
    });
  } catch (error) {
    console.error('Similar events error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting similar events',
      error: error.message
    });
  }
});

module.exports = router;
