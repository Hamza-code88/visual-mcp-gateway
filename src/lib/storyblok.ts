import { storyblokInit, apiPlugin, getStoryblokApi } from '@storyblok/react/rsc';

// Initialize Storyblok for API fetching and content pushing
storyblokInit({
  accessToken: process.env.STORYBLOK_TOKEN || '',
  use: [apiPlugin],
});

export const storyblokApi = getStoryblokApi();

/**
 * Utility to push generated content to Storyblok Management API
 */
export async function pushContentToStoryblok(content: any) {
  // Implementation will use Storyblok Management API
  // to save the draft content.
  console.log('Pushing content to Storyblok...', content);
}
