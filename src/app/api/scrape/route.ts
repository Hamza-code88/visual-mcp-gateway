import { NextResponse } from 'next/server';
import { scrapeLocalCompetitors } from '@/lib/brightdata';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Call Bright Data to get raw footprints
    const result = await scrapeLocalCompetitors(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json({ error: 'Failed to scrape competitors' }, { status: 500 });
  }
}
