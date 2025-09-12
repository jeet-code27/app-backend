// controllers/facebookController.js - Fixed version with updated posts fields

const axios = require('axios');
const User = require('../models/User');

// Facebook App credentials from environment
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * STEP 4: Get Page Insights - FIXED with valid metrics
 */
exports.getPageInsights = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { period = '28', since, until } = req.query;
    
    console.log('🔍 Getting insights for page:', pageId);
    console.log('🔍 User ID:', req.user.id);
    
    const user = await User.findById(req.user.id);
    
    if (!user.facebookData || !user.facebookData.pages) {
      console.log('❌ No Facebook pages found for user');
      return res.status(400).json({
        success: false,
        message: 'No Facebook pages found. Please connect your Facebook account first.'
      });
    }
    
    // Find the specific page and its access token
    const page = user.facebookData.pages.find(p => p.id === pageId);
    
    if (!page) {
      console.log('❌ Page not found:', pageId);
      return res.status(404).json({
        success: false,
        message: 'Page not found in your connected pages'
      });
    }
    
    console.log('✅ Found page:', page.name);
    
    // Get basic page info first
    let pageInfo = {};
    try {
      const pageInfoResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
        params: {
          access_token: page.access_token,
          fields: 'id,name,category,fan_count,followers_count,link,picture,about,website,engagement'
        }
      });
      
      pageInfo = pageInfoResponse.data;
      console.log('✅ Page info retrieved successfully');
      
    } catch (pageError) {
      console.log('❌ Error getting page info:', pageError.response?.data);
      return res.status(400).json({
        success: false,
        message: 'Failed to access page. Token might be invalid.',
        error: pageError.response?.data || pageError.message
      });
    }
    
    // Define valid metrics based on Facebook API documentation
    const validMetrics = [
      // Basic engagement metrics (usually available)
      'page_post_engagements',
      'page_posts_impressions',
      'page_actions_post_reactions_total',
      
      // Page views and reach (may require more data)
      'page_views_total',
      'page_fan_adds',
      'page_fan_removes',
      
      // Video metrics (if applicable)
      'page_video_views'
    ];

    let insightsData = {};
    let availableMetrics = [];
    
    // Try each metric individually to see which ones work
    for (const metric of validMetrics) {
      try {
        console.log(`🔍 Trying metric: ${metric}`);
        
        const params = {
          access_token: page.access_token,
          metric: metric,
          period: period === 'lifetime' ? 'lifetime' : 'day'
        };

        // Add date range if period is not lifetime
        if (period !== 'lifetime') {
          const endDate = until ? new Date(until) : new Date();
          const startDate = since ? new Date(since) : new Date(endDate.getTime() - (parseInt(period) * 24 * 60 * 60 * 1000));
          
          params.since = startDate.toISOString().split('T')[0];
          params.until = endDate.toISOString().split('T')[0];
        }
        
        const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/insights`, {
          params
        });
        
        if (response.data.data && response.data.data.length > 0) {
          const insight = response.data.data[0];
          insightsData[metric] = {
            name: insight.name,
            title: insight.title || insight.name,
            description: insight.description || 'No description available',
            values: insight.values || [],
            period: insight.period
          };
          availableMetrics.push(metric);
          console.log(`✅ Successfully got metric: ${metric}`);
        }
        
      } catch (metricError) {
        console.log(`❌ Metric ${metric} failed:`, metricError.response?.data?.error?.message);
        // Continue to next metric
      }
    }
    
    // If no metrics worked, try to get what's available without specifying metrics
    if (availableMetrics.length === 0) {
      console.log('🔍 No individual metrics worked, trying to get available insights...');
      
      try {
        // Try to get insights without specific metrics to see what's available
        const availableResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/available_insights`, {
          params: {
            access_token: page.access_token
          }
        });
        
        console.log('📋 Available insights:', availableResponse.data);
        
        return res.status(200).json({
          success: true,
          message: 'Page info retrieved, but no insights available',
          data: {
            pageInfo,
            availableInsights: availableResponse.data,
            message: 'This page may not have enough data for insights, or insights may not be enabled.'
          }
        });
        
      } catch (availableError) {
        // Even available insights failed, return just page info
        console.log('❌ Available insights also failed');
        
        return res.status(200).json({
          success: true,
          message: 'Page info retrieved, but insights are not available',
          data: {
            pageInfo,
            insights: {},
            warning: 'Insights are not available for this page. This could be because:',
            possibleReasons: [
              'Page doesn\'t have enough data (needs 30+ days and some activity)',
              'Page insights are not enabled',
              'App doesn\'t have proper insights permissions',
              'Page is too new or inactive'
            ]
          }
        });
      }
    }
    
    // Success - return the insights we could get
    console.log(`✅ Successfully retrieved ${availableMetrics.length} insights metrics`);
    
    res.status(200).json({
      success: true,
      message: `Page insights retrieved successfully (${availableMetrics.length} metrics)`,
      data: {
        pageInfo,
        insights: insightsData,
        period,
        availableMetrics,
        fetchedAt: new Date(),
        debug: {
          pageId: pageId,
          pageName: page.name,
          totalMetricsAttempted: validMetrics.length,
          successfulMetrics: availableMetrics.length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Complete error in getPageInsights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get page insights',
      error: error.response?.data || error.message
    });
  }
};

/**
 * STEP 5: Get Page Posts - FIXED to remove deprecated fields  
 */
/**
 * Get Page Posts - Updated to correctly fetch image and video URLs
 *
 * This function retrieves posts from a specified Facebook Page.
 * It has been updated to request the necessary fields for both images (`image`)
 * and videos (`source`) and correctly processes the response to extract the media URL.
 * It also includes robust error handling and a fallback to the `/feed` endpoint.
 */
exports.getPagePosts = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { limit = 10, since, until } = req.query;

    console.log('🔍 Getting posts for page:', pageId);

    const user = await User.findById(req.user.id);
    const page = user.facebookData.pages.find(p => p.id === pageId);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found in your connected pages'
      });
    }

    console.log('✅ Found page for posts:', page.name);

    // Build request parameters with updated fields for both images and videos
    const params = {
      access_token: page.access_token,
      // UPDATED: Request `source` for videos and `image` for photos within the media object.
      fields: 'id,message,created_time,type,attachments{media{image,source},media_type,type,url,subattachments{media{image,source},media_type,type,url}},likes.summary(true),comments.summary(true),reactions.summary(true),permalink_url',
      limit: Math.min(parseInt(limit), 100) // Cap at 100
    };

    // Add date filters if provided
    if (since) {
      params.since = new Date(since).toISOString();
    }
    if (until) {
      params.until = new Date(until).toISOString();
    }

    // Try the /posts endpoint first as it's more comprehensive
    try {
      console.log('🔍 Trying /posts endpoint...');
      const postsResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/posts`, {
        params
      });

      console.log('✅ Posts retrieved successfully');
      console.log('📊 Posts count:', postsResponse.data.data.length);

      // Process posts to add engagement metrics and media URLs
      const processedPosts = postsResponse.data.data.map(post => {
        const likesCount = post.likes?.summary?.total_count || 0;
        const commentsCount = post.comments?.summary?.total_count || 0;
        const reactionsCount = post.reactions?.summary?.total_count || 0;

        // Extract media from attachments and subattachments
        const media = [];
        if (post.attachments?.data) {
          post.attachments.data.forEach(attachment => {
            if (attachment.media) {
              media.push({
                type: attachment.media_type || attachment.type,
                // UPDATED: Prioritize video `source`, then image `src`, then fallback to attachment `url`
                url: attachment.media.source || attachment.media.image?.src || attachment.url,
                width: attachment.media.image?.width,
                height: attachment.media.image?.height
              });
            }

            if (attachment.subattachments?.data) {
              attachment.subattachments.data.forEach(subAttachment => {
                if (subAttachment.media) {
                  media.push({
                    type: subAttachment.media_type || subAttachment.type,
                    // UPDATED: Logic repeated for subattachments
                    url: subAttachment.media.source || subAttachment.media.image?.src || subAttachment.url,
                    width: subAttachment.media.image?.width,
                    height: subAttachment.media.image?.height
                  });
                }
              });
            }
          });
        }

        const totalReactions = reactionsCount > 0 ? reactionsCount : likesCount;

        return {
          ...post,
          media, // Add media array
          engagement: {
            likes: likesCount,
            comments: commentsCount,
            reactions: reactionsCount,
            total: totalReactions + commentsCount
          },
          formatted_date: new Date(post.created_time).toLocaleDateString(),
          post_type: post.type || 'status',
          message_preview: post.message ? post.message.substring(0, 100) + (post.message.length > 100 ? '...' : '') : 'No message'
        };
      });

      // Calculate summary statistics
      const totalEngagement = processedPosts.reduce((sum, p) => sum + p.engagement.total, 0);
      const avgEngagement = processedPosts.length > 0 ? Math.round(totalEngagement / processedPosts.length) : 0;
      const mostEngagingPost = processedPosts.length > 0 ? processedPosts.reduce((max, p) => (p.engagement.total > max.engagement.total ? p : max)) : null;

      res.status(200).json({
        success: true,
        message: 'Page posts retrieved successfully',
        data: {
          posts: processedPosts,
          paging: postsResponse.data.paging,
          totalPosts: processedPosts.length,
          summary: {
            totalEngagement,
            avgEngagementPerPost: avgEngagement,
            mostEngagingPost: mostEngagingPost ? {
              id: mostEngagingPost.id,
              message: mostEngagingPost.message_preview,
              engagement: mostEngagingPost.engagement.total,
              created_time: mostEngagingPost.created_time
            } : null,
            postTypes: [...new Set(processedPosts.map(p => p.post_type))]
          },
          debug: {
            endpoint: 'posts',
            fieldsUsed: params.fields.split(',')
          }
        }
      });

    } catch (postsError) {
      console.log('❌ /posts endpoint failed, trying /feed endpoint...', postsError.response?.data?.error?.message);

      // Fallback to /feed endpoint with minimal fields
      try {
        const feedParams = {
          access_token: page.access_token,
          fields: 'id,message,created_time,likes.summary(true),comments.summary(true)',
          limit: Math.min(parseInt(limit), 100)
        };
        if (since) feedParams.since = new Date(since).toISOString();
        if (until) feedParams.until = new Date(until).toISOString();

        console.log('🔍 Trying /feed endpoint with minimal fields...');
        const feedResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
          params: feedParams
        });

        console.log('✅ Feed retrieved successfully');

        const processedFeed = feedResponse.data.data.map(post => {
          const likesCount = post.likes?.summary?.total_count || 0;
          const commentsCount = post.comments?.summary?.total_count || 0;
          return {
            ...post,
            engagement: {
              likes: likesCount,
              comments: commentsCount,
              reactions: 0,
              total: likesCount + commentsCount
            },
            formatted_date: new Date(post.created_time).toLocaleDateString(),
            post_type: 'feed_item',
            message_preview: post.message ? post.message.substring(0, 100) + (post.message.length > 100 ? '...' : '') : 'No message'
          };
        });

        const totalEngagement = processedFeed.reduce((sum, p) => sum + p.engagement.total, 0);
        const avgEngagement = processedFeed.length > 0 ? Math.round(totalEngagement / processedFeed.length) : 0;

        res.status(200).json({
          success: true,
          message: 'Page feed retrieved successfully (fallback method)',
          data: {
            posts: processedFeed,
            paging: feedResponse.data.paging,
            totalPosts: processedFeed.length,
            summary: {
              totalEngagement,
              avgEngagementPerPost: avgEngagement,
              note: 'Using feed endpoint with limited data due to API restrictions.'
            },
            debug: {
              endpoint: 'feed (fallback)',
              fieldsUsed: feedParams.fields.split(','),
              originalError: postsError.response?.data?.error?.message
            }
          }
        });

      } catch (feedError) {
        console.log('❌ Both /posts and /feed endpoints failed.');
        res.status(400).json({
          success: false,
          message: 'Failed to get page posts from both primary and fallback endpoints.',
          error: {
            postsEndpoint: postsError.response?.data || postsError.message,
            feedEndpoint: feedError.response?.data || feedError.message
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Complete error in getPagePosts:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while getting page posts.',
      error: error.response?.data || error.message
    });
  }
};

// Keep all other existing functions the same...
exports.getFacebookLoginUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const permissions = [
      'pages_read_engagement',
      'pages_show_list',
      'read_insights'
    ].join(',');
    
    const facebookLoginUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}&` +
      `redirect_uri=${FRONTEND_URL}/facebook/callback&` +
      `scope=${permissions}&` +
      `response_type=code&` +
      `state=${userId}`;
    
    res.status(200).json({
      success: true,
      message: 'Facebook login URL generated',
      data: {
        loginUrl: facebookLoginUrl,
        permissions: permissions.split(',')
      }
    });
    
  } catch (error) {
    console.error('Error generating Facebook login URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Facebook login URL',
      error: error.message
    });
  }
};

exports.handleFacebookCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code not provided'
      });
    }
    
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: `${FRONTEND_URL}/facebook/callback`,
        code: code
      }
    });
    
    const userAccessToken = tokenResponse.data.access_token;
    
    const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token: userAccessToken,
        fields: 'id,name,access_token,category,tasks'
      }
    });
    
    const user = await User.findById(state);
    if (user) {
      user.facebookData = {
        userAccessToken: userAccessToken,
        pages: pagesResponse.data.data,
        connectedAt: new Date()
      };
      await user.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Facebook connected successfully',
      data: {
        pages: pagesResponse.data.data,
        totalPages: pagesResponse.data.data.length
      }
    });
    
  } catch (error) {
    console.error('Error handling Facebook callback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect Facebook account',
      error: error.response?.data || error.message
    });
  }
};

exports.getFacebookPages = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.facebookData || !user.facebookData.userAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Facebook account not connected. Please connect your Facebook account first.'
      });
    }
    
    const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token: user.facebookData.userAccessToken,
        fields: 'id,name,access_token,category,tasks,fan_count,followers_count'
      }
    });
    
    user.facebookData.pages = pagesResponse.data.data;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Facebook pages retrieved successfully',
      data: {
        pages: pagesResponse.data.data,
        totalPages: pagesResponse.data.data.length
      }
    });
    
  } catch (error) {
    console.error('Error getting Facebook pages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Facebook pages',
      error: error.response?.data || error.message
    });
  }
};

exports.disconnectFacebook = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.facebookData) {
      return res.status(400).json({
        success: false,
        message: 'No Facebook account connected'
      });
    }
    
    user.facebookData = undefined;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Facebook account disconnected successfully'
    });
    
  } catch (error) {
    console.error('Error disconnecting Facebook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Facebook account',
      error: error.message
    });
  }
};

exports.getFacebookStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const isConnected = !!(user.facebookData && user.facebookData.userAccessToken);
    
    res.status(200).json({
      success: true,
      data: {
        isConnected: isConnected,
        connectedAt: user.facebookData?.connectedAt || null,
        totalPages: user.facebookData?.pages?.length || 0,
        pages: isConnected ? user.facebookData.pages.map(page => ({
          id: page.id,
          name: page.name,
          category: page.category
        })) : []
      }
    });
    
  } catch (error) {
    console.error('Error getting Facebook status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Facebook status',
      error: error.message
    });
  }
};