const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.gemini = null;
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize Google Gemini
    if (process.env.GOOGLE_GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    }
  }

  async generateEventDescription(eventDetails) {
    const { title, category, location, startDateTime, endDateTime, targetAudience } = eventDetails;
    
    const prompt = `Generate a compelling and professional event description for the following event:
    
Title: ${title}
Category: ${category || 'General'}
Location: ${location || 'To be announced'}
Date: ${startDateTime ? new Date(startDateTime).toLocaleDateString() : 'TBD'} - ${endDateTime ? new Date(endDateTime).toLocaleDateString() : 'TBD'}
Target Audience: ${targetAudience || 'General public'}

Requirements:
- Write a 2-3 paragraph description
- Make it engaging and informative
- Include a brief welcome statement
- Highlight key benefits of attending
- End with a call to action
- Keep it professional but approachable
- Do not use markdown formatting

Return only the description text, no additional commentary.`;

    return this.generateText(prompt);
  }

  async generateEventTags(eventDetails) {
    const { title, description, category } = eventDetails;
    
    const prompt = `Generate relevant tags for the following event:

Title: ${title}
Description: ${description}
Category: ${category || 'General'}

Requirements:
- Generate 5-8 relevant tags
- Tags should be lowercase
- Tags should be single words or short phrases
- Include the category as a tag
- Include relevant industry terms
- Return as a comma-separated list

Return only the tags, no additional commentary.`;

    const result = await this.generateText(prompt);
    return result.split(',').map(tag => tag.trim().toLowerCase());
  }

  async generateTaskBreakdown(eventDetails) {
    const { title, description, startDateTime, category } = eventDetails;
    
    const prompt = `Create a task breakdown for organizing the following event:

Title: ${title}
Description: ${description}
Date: ${startDateTime ? new Date(startDateTime).toLocaleDateString() : 'TBD'}
Category: ${category || 'General'}

Requirements:
- Generate 8-12 actionable tasks
- Tasks should be specific and measurable
- Include tasks for planning, preparation, execution, and follow-up
- Prioritize tasks (high, medium, low)
- Estimate reasonable deadlines relative to event date

Format each task as:
[Priority] Task title - Brief description

Return only the tasks, one per line.`;

    const result = await this.generateText(prompt);
    return this.parseTaskBreakdown(result, startDateTime);
  }

  parseTaskBreakdown(text, eventDate) {
    const lines = text.split('\n').filter(line => line.trim());
    const tasks = [];
    const eventTime = eventDate ? new Date(eventDate).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000;
    
    lines.forEach((line, index) => {
      const priorityMatch = line.match(/\[(high|medium|low)\]/i);
      const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';
      const cleanLine = line.replace(/\[(high|medium|low)\]/i, '').trim();
      const parts = cleanLine.split('-');
      
      tasks.push({
        title: parts[0]?.trim() || `Task ${index + 1}`,
        description: parts.slice(1).join('-').trim() || '',
        priority,
        dueDate: new Date(eventTime - (lines.length - index) * 24 * 60 * 60 * 1000)
      });
    });
    
    return tasks;
  }

  async suggestEventTitle(keywords, category) {
    const prompt = `Generate 5 creative and professional event titles based on:

Keywords: ${keywords.join(', ')}
Category: ${category || 'General'}

Requirements:
- Titles should be catchy and memorable
- Keep them concise (3-8 words)
- Make them professional but engaging
- Include variety in style (formal, creative, action-oriented)

Return one title per line, no numbering or bullets.`;

    const result = await this.generateText(prompt);
    return result.split('\n').filter(line => line.trim()).slice(0, 5);
  }

  async improveText(text, context = 'general') {
    const prompt = `Improve the following text for a ${context} context:

Original text:
"${text}"

Requirements:
- Fix any grammar or spelling errors
- Improve clarity and flow
- Make it more engaging
- Maintain the original meaning
- Keep a professional tone

Return only the improved text.`;

    return this.generateText(prompt);
  }

  async generateSocialMediaPost(eventDetails, platform = 'general') {
    const { title, description, startDateTime, location } = eventDetails;
    
    const platformGuidelines = {
      twitter: 'Maximum 280 characters, use hashtags, be concise',
      linkedin: 'Professional tone, 1-2 paragraphs, industry focused',
      instagram: 'Engaging, use emojis, include call to action',
      facebook: 'Conversational, medium length, encourage engagement',
      general: 'Versatile, professional yet engaging, moderate length'
    };

    const prompt = `Create a ${platform} post for this event:

Title: ${title}
Description: ${description}
Date: ${startDateTime ? new Date(startDateTime).toLocaleDateString() : 'TBD'}
Location: ${location || 'Online'}

Platform guidelines: ${platformGuidelines[platform] || platformGuidelines.general}

Return only the post content.`;

    return this.generateText(prompt);
  }

  async answerEventQuestion(question, eventDetails) {
    const { title, description, startDateTime, endDateTime, location, price, category } = eventDetails;
    
    const prompt = `Answer the following question about this event:

Event Details:
- Title: ${title}
- Description: ${description}
- Start: ${startDateTime ? new Date(startDateTime).toLocaleString() : 'TBD'}
- End: ${endDateTime ? new Date(endDateTime).toLocaleString() : 'TBD'}
- Location: ${location || 'TBD'}
- Price: ${price || 'Free'}
- Category: ${category || 'General'}

Question: ${question}

Requirements:
- Answer based on the provided information
- If information is not available, say so politely
- Keep the answer concise and helpful
- Be professional but friendly

Return only the answer.`;

    return this.generateText(prompt);
  }

  async generateText(prompt) {
    // Try Gemini first
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        console.error('Gemini API error:', error.message);
      }
    }

    // Fallback: return a helpful message
    throw new Error('AI service not configured. Please set GOOGLE_GEMINI_API_KEY in environment variables.');
  }

  async analyzeEventSentiment(reviews) {
    if (!reviews || reviews.length === 0) {
      return { sentiment: 'neutral', score: 0, summary: 'No reviews to analyze' };
    }

    const reviewTexts = reviews.slice(0, 20).map(r => r.comment || r.text).join('\n');
    
    const prompt = `Analyze the sentiment of these event reviews:

${reviewTexts}

Provide:
1. Overall sentiment (positive, negative, neutral, mixed)
2. Sentiment score (-1 to 1)
3. Brief summary (1-2 sentences)

Format: sentiment|score|summary`;

    try {
      const result = await this.generateText(prompt);
      const [sentiment, score, summary] = result.split('|').map(s => s.trim());
      return {
        sentiment: sentiment || 'neutral',
        score: parseFloat(score) || 0,
        summary: summary || 'Unable to analyze sentiment'
      };
    } catch (error) {
      return { sentiment: 'neutral', score: 0, summary: 'Sentiment analysis unavailable' };
    }
  }

  async recommendEvents(userPreferences, availableEvents) {
    const { interests, pastEvents, location } = userPreferences;
    
    const eventsText = availableEvents.slice(0, 10).map(e => 
      `ID: ${e._id} | Title: ${e.title} | Category: ${e.category?.name || 'General'} | Location: ${e.location}`
    ).join('\n');

    const prompt = `Recommend events based on user preferences:

User Interests: ${interests?.join(', ') || 'Not specified'}
Past Events: ${pastEvents?.join(', ') || 'None'}
Location: ${location || 'Not specified'}

Available Events:
${eventsText}

Return the top 5 recommended event IDs in order of relevance, comma-separated.`;

    try {
      const result = await this.generateText(prompt);
      return result.split(',').map(id => id.trim()).filter(id => id);
    } catch (error) {
      return availableEvents.slice(0, 5).map(e => e._id.toString());
    }
  }
}

module.exports = new AIService();
