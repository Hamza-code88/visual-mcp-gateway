import { algoliasearch } from 'algoliasearch';

const appId = process.env.ALGOLIA_APP_ID || '';
const apiKey = process.env.ALGOLIA_API_KEY || '';

// Initialize the Algolia client
export const searchClient = algoliasearch(appId, apiKey);

// Example index for SEO insights
export const insightsIndexName = 'seo_insights';
