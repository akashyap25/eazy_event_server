const axios = require('axios');

class SocialMediaService {
  constructor() {
    this.platforms = {
      facebook: {
        name: 'Facebook',
        icon: 'facebook',
        color: '#1877F2',
        shareUrl: 'https://www.facebook.com/sharer/sharer.php',
        loginUrl: '/auth/facebook'
      },
      twitter: {
        name: 'Twitter',
        icon: 'twitter',
        color: '#1DA1F2',
        shareUrl: 'https://twitter.com/intent/tweet',
        loginUrl: '/auth/twitter'
      },
      linkedin: {
        name: 'LinkedIn',
        icon: 'linkedin',
        color: '#0077B5',
        shareUrl: 'https://www.linkedin.com/sharing/share-offsite/',
        loginUrl: '/auth/linkedin'
      },
      whatsapp: {
        name: 'WhatsApp',
        icon: 'whatsapp',
        color: '#25D366',
        shareUrl: 'https://wa.me/',
        loginUrl: null
      },
      telegram: {
        name: 'Telegram',
        icon: 'telegram',
        color: '#0088CC',
        shareUrl: 'https://t.me/share/url',
        loginUrl: null
      },
      reddit: {
        name: 'Reddit',
        icon: 'reddit',
        color: '#FF4500',
        shareUrl: 'https://reddit.com/submit',
        loginUrl: null
      },
      instagram: {
        name: 'Instagram',
        icon: 'instagram',
        color: '#E4405F',
        shareUrl: 'https://www.instagram.com/',
        loginUrl: null
      }
    };
  }

  /**
   * Generate share URL for a platform
   * @param {String} platform - Platform name
   * @param {Object} data - Share data
   * @returns {String} Share URL
   */
  generateShareUrl(platform, data) {
    const { title, description, url, image, hashtags } = data;
    const platformConfig = this.platforms[platform];

    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const baseUrl = platformConfig.shareUrl;
    const params = new URLSearchParams();

    switch (platform) {
      case 'facebook':
        params.append('u', url);
        if (title) params.append('quote', title);
        if (description) params.append('description', description);
        break;

      case 'twitter':
        params.append('url', url);
        if (title) params.append('text', title);
        if (hashtags) params.append('hashtags', hashtags.join(','));
        break;

      case 'linkedin':
        params.append('url', url);
        if (title) params.append('title', title);
        if (description) params.append('summary', description);
        break;

      case 'whatsapp':
        const whatsappText = `${title || ''}\n\n${description || ''}\n\n${url}`;
        return `${baseUrl}?text=${encodeURIComponent(whatsappText)}`;

      case 'telegram':
        params.append('url', url);
        if (title) params.append('text', title);
        break;

      case 'reddit':
        params.append('url', url);
        if (title) params.append('title', title);
        break;

      case 'pinterest':
        params.append('url', url);
        if (title) params.append('description', title);
        if (image) params.append('media', image);
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Generate share URLs for all platforms
   * @param {Object} data - Share data
   * @returns {Object} Share URLs for all platforms
   */
  generateAllShareUrls(data) {
    const shareUrls = {};

    for (const platform in this.platforms) {
      try {
        shareUrls[platform] = this.generateShareUrl(platform, data);
      } catch (error) {
        console.error(`Failed to generate share URL for ${platform}:`, error);
        shareUrls[platform] = null;
      }
    }

    return shareUrls;
  }

  /**
   * Generate event share data
   * @param {Object} event - Event data
   * @returns {Object} Share data
   */
  generateEventShareData(event) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const eventUrl = `${baseUrl}/events/${event._id}`;
    
    return {
      title: event.title,
      description: event.description || `Join me at ${event.title} on ${new Date(event.startDateTime).toLocaleDateString()}`,
      url: eventUrl,
      image: event.imageUrl || `${baseUrl}/images/default-event.jpg`,
      hashtags: this.generateEventHashtags(event)
    };
  }

  /**
   * Generate hashtags for an event
   * @param {Object} event - Event data
   * @returns {Array} Array of hashtags
   */
  generateEventHashtags(event) {
    const hashtags = ['EazyEvent', 'Event'];
    
    if (event.category && event.category.name) {
      hashtags.push(event.category.name.replace(/\s+/g, ''));
    }
    
    if (event.location) {
      const location = event.location.split(',')[0].replace(/\s+/g, '');
      hashtags.push(location);
    }
    
    const eventDate = new Date(event.startDateTime);
    const month = eventDate.toLocaleString('default', { month: 'long' });
    hashtags.push(month);
    
    return hashtags;
  }

  /**
   * Get platform configuration
   * @param {String} platform - Platform name
   * @returns {Object} Platform configuration
   */
  getPlatformConfig(platform) {
    return this.platforms[platform] || null;
  }

  /**
   * Get all platform configurations
   * @returns {Object} All platform configurations
   */
  getAllPlatformConfigs() {
    return this.platforms;
  }

  /**
   * Get supported platforms for sharing
   * @returns {Array} Array of supported platforms
   */
  getSupportedPlatforms() {
    return Object.keys(this.platforms);
  }

  /**
   * Get supported platforms for login
   * @returns {Array} Array of platforms that support login
   */
  getLoginSupportedPlatforms() {
    return Object.keys(this.platforms).filter(platform => 
      this.platforms[platform].loginUrl !== null
    );
  }

  /**
   * Generate social media preview data
   * @param {Object} event - Event data
   * @returns {Object} Preview data
   */
  generateSocialPreview(event) {
    const shareData = this.generateEventShareData(event);
    
    return {
      title: shareData.title,
      description: shareData.description,
      url: shareData.url,
      image: shareData.image,
      hashtags: shareData.hashtags,
      platforms: this.getAllPlatformConfigs(),
      shareUrls: this.generateAllShareUrls(shareData)
    };
  }

  /**
   * Generate embed code for event
   * @param {Object} event - Event data
   * @param {Object} options - Embed options
   * @returns {String} Embed code
   */
  generateEmbedCode(event, options = {}) {
    const {
      width = 400,
      height = 300,
      theme = 'light',
      showImage = true,
      showDescription = true,
      showDate = true,
      showLocation = true
    } = options;

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const eventUrl = `${baseUrl}/events/${event._id}`;
    
    const embedHtml = `
      <div style="
        width: ${width}px;
        height: ${height}px;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: ${theme === 'dark' ? '#1a1a1a' : '#ffffff'};
        color: ${theme === 'dark' ? '#ffffff' : '#000000'};
      ">
        ${showImage && event.imageUrl ? `
          <div style="
            width: 100%;
            height: 150px;
            background-image: url('${event.imageUrl}');
            background-size: cover;
            background-position: center;
          "></div>
        ` : ''}
        
        <div style="padding: 16px;">
          <h3 style="
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 600;
            color: ${theme === 'dark' ? '#ffffff' : '#000000'};
          ">${event.title}</h3>
          
          ${showDescription && event.description ? `
            <p style="
              margin: 0 0 12px 0;
              font-size: 14px;
              color: ${theme === 'dark' ? '#cccccc' : '#666666'};
              line-height: 1.4;
            ">${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}</p>
          ` : ''}
          
          ${showDate ? `
            <div style="
              margin: 0 0 8px 0;
              font-size: 14px;
              color: ${theme === 'dark' ? '#cccccc' : '#666666'};
            ">
              📅 ${new Date(event.startDateTime).toLocaleDateString()} at ${new Date(event.startDateTime).toLocaleTimeString()}
            </div>
          ` : ''}
          
          ${showLocation && event.location ? `
            <div style="
              margin: 0 0 12px 0;
              font-size: 14px;
              color: ${theme === 'dark' ? '#cccccc' : '#666666'};
            ">
              📍 ${event.location}
            </div>
          ` : ''}
          
          <a href="${eventUrl}" style="
            display: inline-block;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
          ">View Event</a>
        </div>
      </div>
    `;

    return embedHtml;
  }

  /**
   * Generate QR code data for event
   * @param {Object} event - Event data
   * @returns {Object} QR code data
   */
  generateQRCodeData(event) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const eventUrl = `${baseUrl}/events/${event._id}`;
    
    return {
      url: eventUrl,
      title: event.title,
      size: 200,
      format: 'png',
      errorCorrectionLevel: 'M'
    };
  }

  /**
   * Generate social media analytics data
   * @param {Object} event - Event data
   * @param {Object} analytics - Analytics data
   * @returns {Object} Social media analytics
   */
  generateSocialAnalytics(event, analytics) {
    const shareData = this.generateEventShareData(event);
    
    return {
      event: {
        id: event._id,
        title: event.title,
        url: shareData.url
      },
      platforms: this.getAllPlatformConfigs(),
      metrics: {
        totalShares: analytics.totalShares || 0,
        platformShares: analytics.platformShares || {},
        clickThroughRate: analytics.clickThroughRate || 0,
        engagementRate: analytics.engagementRate || 0
      },
      recommendations: this.generateSharingRecommendations(event, analytics)
    };
  }

  /**
   * Generate sharing recommendations
   * @param {Object} event - Event data
   * @param {Object} analytics - Analytics data
   * @returns {Array} Sharing recommendations
   */
  generateSharingRecommendations(event, analytics) {
    const recommendations = [];
    
    // Time-based recommendations
    const eventDate = new Date(event.startDateTime);
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilEvent > 7) {
      recommendations.push({
        type: 'timing',
        message: 'Share early to build anticipation',
        platforms: ['facebook', 'linkedin']
      });
    } else if (daysUntilEvent <= 1) {
      recommendations.push({
        type: 'timing',
        message: 'Share now for last-minute attendees',
        platforms: ['twitter', 'whatsapp']
      });
    }
    
    // Platform-specific recommendations
    if (event.category && event.category.name === 'Professional') {
      recommendations.push({
        type: 'platform',
        message: 'LinkedIn is perfect for professional events',
        platforms: ['linkedin']
      });
    }
    
    if (event.isFree) {
      recommendations.push({
        type: 'platform',
        message: 'Highlight the free nature on social media',
        platforms: ['twitter', 'facebook']
      });
    }
    
    return recommendations;
  }
}

module.exports = new SocialMediaService();